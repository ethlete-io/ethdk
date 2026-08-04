import { computed, DestroyRef, Directive, inject, Injector, input, signal, WritableSignal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { injectStyleManager } from '@ethlete/core';
import { Subscription, tap, timer } from 'rxjs';
import { injectTableFeatureHost, TableFeatureConfig, tableFeatureConfig } from './headless/table-features';
import { TableDetailStylesComponent } from './table-detail-styles.component';
import { TableExpanderCellComponent } from './table-expander-cell.component';
import { TableRowDetailComponent } from './table-row-detail.component';

/** Detail-row enter/leave duration (must match the CSS animations) - see {@link TableRowExpansionDirective.animates}. */
const DETAIL_ANIMATION_MS = 200;

/** Options for {@link TableRowExpansionDirective}. */
export type TableRowExpansionConfig<T> = TableFeatureConfig & {
  /**
   * The signal holding the expanded row keys (by the table's `rowKey`, else the row reference). The
   * feature writes into it directly, so pass your own signal to read or drive the expansion - set a
   * `rowKey` on the table so it survives sorting, filtering and data changes, and so it can be
   * serialized into `state()`. Omit it and the expansion is kept internally (reachable via `exportAs`).
   */
  expanded?: WritableSignal<Set<unknown>>;
  /** Gate which rows can expand. Defaults to all rows. */
  expandableRow?: (row: T) => boolean;
};

/**
 * Opt-in row expansion for `et-table`: adds a leading expander column and renders the table's
 * `[expandedRowTemplate]` as a full-width detail row under the row it belongs to.
 *
 * The template stays a table input because only the table knows the row type - that is what gives
 * `let-row` a type instead of `any`. Everything else is here, which is what keeps the expander cell, the
 * detail row's chrome and its grow-open animation out of a table that never expands a row.
 *
 * @example
 * protected expanded = signal<Set<unknown>>(new Set());
 *
 * <et-table
 *   [data]="users()"
 *   [columns]="COLUMNS"
 *   [rowKey]="rowId"
 *   [expandedRowTemplate]="detail"
 *   [etTableRowExpansion]="{ expanded: expanded }"
 * >
 *   <ng-template #detail let-user>{{ user.bio }}</ng-template>
 * </et-table>
 */
@Directive({
  selector: '[etTableRowExpansion]',
  exportAs: 'etTableRowExpansion',
})
export class TableRowExpansionDirective<T> {
  private table = injectTableFeatureHost('etTableRowExpansion');
  private destroyRef = inject(DestroyRef);

  /** See {@link TableRowExpansionConfig}. */
  public config = input({} as TableRowExpansionConfig<T>, {
    alias: 'etTableRowExpansion',
    transform: tableFeatureConfig<TableRowExpansionConfig<T>>,
  });

  // Used when the consumer passes no signal of their own, so a bare `etTableRowExpansion` still expands.
  private ownExpanded = signal<Set<unknown>>(new Set());

  /** The signal the expanded keys are kept in - the consumer's when they passed one, else the feature's own. */
  public expanded = computed(() => this.config().expanded ?? this.ownExpanded);

  // The row key the user just toggled, cleared once the animation has run. Compared by identity in
  // `animates`, so any other (re-)mount of a detail row skips the animation.
  private userToggledKey = signal<unknown>(null);
  private userToggleReset: Subscription | undefined;

  constructor() {
    const injector = inject(Injector);

    this.table.registerLeadColumn({
      key: 'et-table-expander',
      width: 'var(--et-table-expander-width, 32px)',
      // after any other feature column, so a select checkbox stays leftmost
      order: 100,
      cellClass: 'et-table-expander-cell',
      bodyComponent: TableExpanderCellComponent,
      injector,
      enabled: computed(() => this.config().enabled ?? true),
    });

    this.table.registerRowDetail({
      component: TableRowDetailComponent,
      isOpen: (row) => this.canExpand(row as T) && this.isExpanded(row as T),
      injector,
      enabled: computed(() => this.config().enabled ?? true),
    });

    // The expanded rows are the feature's own state, so they travel in `state().features.expansion`
    // rather than in the base table's own entries - see TableStateSlice. A table without a `rowKey`
    // keys by row reference and has nothing stable to write, so it contributes nothing.
    this.table.registerStateSlice({
      key: 'expansion',
      read: () => {
        const keys = [...this.expanded()()];

        return keys.length ? keys.map(String) : undefined;
      },
      write: (value) => {
        if (Array.isArray(value)) this.expanded().set(new Set(value.map(String)));
      },
    });

    // The detail row's chrome and keyframes are the largest block the table's CSS had, and do nothing
    // without expansion - so they arrive with the feature. Mounted here rather than from the detail row
    // itself so the rules are in the document before the first expansion animates. The style manager
    // de-duplicates across every table in the app.
    injectStyleManager().mount(TableDetailStylesComponent);
  }

  /** Whether a row is currently expanded. */
  public isExpanded(row: T) {
    return this.expanded()().has(this.table.rowIdentity(row));
  }

  /** Whether a row may expand at all (see `expandableRow`). */
  public canExpand(row: T) {
    return this.config().expandableRow?.(row) ?? true;
  }

  /**
   * Whether this row's detail row should animate open/closed.
   *
   * Only the row the user just toggled does. A detail row also mounts and unmounts when the rows
   * themselves change - paging away and back, sorting, a query refresh - and animating those replays an
   * open/close the user never asked for (and pays the layout cost mid page-change).
   */
  public animates(row: unknown) {
    return this.userToggledKey() === this.table.rowIdentity(row);
  }

  /** Toggle a row's expanded state. */
  public toggle(row: T) {
    const key = this.table.rowIdentity(row);
    const next = new Set(this.expanded()());

    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }

    this.markUserToggled(key);
    this.expanded().set(next);
  }

  private markUserToggled(key: unknown) {
    this.userToggledKey.set(key);
    this.userToggleReset?.unsubscribe();
    this.userToggleReset = timer(DETAIL_ANIMATION_MS)
      .pipe(
        tap(() => this.userToggledKey.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
}
