import { Component, DestroyRef, ViewEncapsulation, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { copyToClipboard } from '@ethlete/core';
import { timer } from 'rxjs';
import { tap } from 'rxjs/operators';
import { GridComponent } from './grid.component';
import { GridItemConfig, GridItemPosition } from './headless/grid.types';

const posEq = (a: GridItemPosition | undefined, b: GridItemPosition | undefined) => {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.col === b.col && a.row === b.row && a.colSpan === b.colSpan && a.rowSpan === b.rowSpan;
};

/**
 * Development-only debug overlay for an `et-grid` instance.
 *
 * ```html
 * <et-grid #myGrid [items]="items()" ...></et-grid>
 * <et-grid-debug [grid]="myGrid" [externalItems]="items()" />
 * ```
 *
 * Pass `externalItems` to detect divergence between the host signal and the grid's internal
 * itemConfigs.
 */
@Component({
  selector: 'et-grid-debug',
  template: `
    <details class="et-grid-debug-panel">
      <summary class="et-grid-debug-summary">
        <span class="et-grid-debug-title">et-grid-debug</span>

        <span class="et-grid-debug-muted">
          bp: <strong class="et-grid-debug-strong">{{ activeBreakpoint() }}</strong> &nbsp;·&nbsp;
          {{ containerWidth() }}px &nbsp;·&nbsp; {{ items().length }} items
          @if (hasDrag()) {
            &nbsp;·&nbsp; <span class="et-grid-debug-warning">⠿ dragging</span>
          }
        </span>

        @if (issueCount() > 0) {
          <span class="et-grid-debug-issues">⚠ {{ issueCount() }} issue{{ issueCount() === 1 ? '' : 's' }}</span>
        }

        <button (click)="copyJson($event)" class="et-grid-debug-copy">Copy JSON</button>

        @if (copied()) {
          <span class="et-grid-debug-copied">✓ copied</span>
        }
      </summary>

      <div class="et-grid-debug-body">
        <!-- Breakpoint legend -->
        <div class="et-grid-debug-legend">
          @for (bp of breakpoints(); track bp.name) {
            <span
              [style.fontWeight]="bp.name === activeBreakpoint() ? '700' : '400'"
              [style.color]="bp.name === activeBreakpoint() ? '#1d4ed8' : '#9ca3af'"
              class="et-grid-debug-breakpoint"
              >{{ bp.name }}&nbsp;{{ bp.columns }}col&nbsp;≥{{ bp.minWidth }}px</span
            >
          }
        </div>

        <!-- Layout table -->
        <table class="et-grid-debug-table">
          <thead>
            <tr class="et-grid-debug-head-row">
              <th class="et-grid-debug-cell et-grid-debug-cell-start">id</th>
              <th class="et-grid-debug-cell et-grid-debug-cell-start">type</th>
              @for (bp of breakpoints(); track bp.name) {
                <th
                  [style.background]="bp.name === activeBreakpoint() ? '#dbeafe' : '#f3f4f6'"
                  class="et-grid-debug-cell"
                >
                  {{ bp.name }}{{ hasExternal() ? ' int' : '' }}
                </th>
                @if (hasExternal()) {
                  <th
                    [style.background]="bp.name === activeBreakpoint() ? '#dbeafe' : '#f3f4f6'"
                    class="et-grid-debug-cell et-grid-debug-cell-ext"
                  >
                    {{ bp.name }} ext
                  </th>
                }
              }
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.id) {
              <tr>
                <td class="et-grid-debug-cell et-grid-debug-cell-start et-grid-debug-id">{{ row.id }}</td>
                <td class="et-grid-debug-cell et-grid-debug-cell-start et-grid-debug-type">{{ row.type }}</td>
                @for (cell of row.cells; track cell.bp) {
                  <td
                    [style.color]="cell.intMissing ? '#dc2626' : '#111'"
                    [title]="cell.intMissing ? 'MISSING - layout.' + cell.bp + ' undefined in internal state' : ''"
                    class="et-grid-debug-cell"
                  >
                    {{ fmtPos(cell.int) }}
                  </td>
                  @if (hasExternal()) {
                    <td
                      [style.color]="cell.extMissing ? '#dc2626' : cell.mismatch ? '#d97706' : '#9ca3af'"
                      [title]="cell.mismatch ? 'MISMATCH - ext=' + fmtPos(cell.ext) + ' int=' + fmtPos(cell.int) : ''"
                      class="et-grid-debug-cell"
                    >
                      {{ fmtPos(cell.ext) }}
                    </td>
                  }
                }
              </tr>
            }
          </tbody>
        </table>

        @if (hasExternal()) {
          <p class="et-grid-debug-note">
            int = grid.currentItems() (internal) &nbsp;·&nbsp; ext = externalItems input &nbsp;·&nbsp;
            <span class="et-grid-debug-error">red = undefined</span> &nbsp;·&nbsp;
            <span class="et-grid-debug-warning">orange = mismatch</span>
          </p>
        }
      </div>
    </details>
  `,
  styleUrl: './grid-debug.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class GridDebugComponent<TData = unknown> {
  private destroyRef = inject(DestroyRef);

  public grid = input.required<GridComponent<TData>>();
  public externalItems = input<GridItemConfig<string, TData>[] | null>(null);

  public activeBreakpoint = computed(() => this.grid().grid.activeBreakpoint());
  public containerWidth = computed(() => this.grid().grid.containerWidth());
  public breakpoints = computed(() => this.grid().grid.breakpoints());
  public items = computed(() => this.grid().grid.currentItems());
  public layout = computed(() => this.grid().grid.layout());
  public hasDrag = computed(() => this.grid().grid.dragState() !== null);
  public hasExternal = computed(() => this.externalItems() !== null);
  public copied = signal(false);

  public rows = computed(() => {
    const bps = this.breakpoints().map((b) => b.name);
    const internalItems = this.items();
    const external = this.externalItems();
    const extById = external ? new Map(external.map((i) => [i.id, i])) : null;

    return internalItems.map((item) => ({
      id: item.id,
      type: item.type,
      cells: bps.map((bp) => {
        const int = item.layout[bp] as GridItemPosition | undefined;
        const ext = extById?.get(item.id)?.layout[bp] as GridItemPosition | undefined;
        return {
          bp,
          int,
          ext,
          intMissing: !int,
          extMissing: extById !== null && !ext,
          mismatch: extById !== null && !posEq(int, ext),
        };
      }),
    }));
  });

  public issueCount = computed(() =>
    this.rows().reduce((n, row) => n + row.cells.filter((c) => c.intMissing || c.mismatch).length, 0),
  );

  public fmtPos(pos: GridItemPosition | undefined) {
    return pos ? `(${pos.col},${pos.row}) ${pos.colSpan}×${pos.rowSpan}` : '-';
  }

  public copyJson($event: Event) {
    $event.stopPropagation();

    const issues: { type: string; itemId: string; breakpoint: string }[] = [];
    for (const row of this.rows()) {
      for (const cell of row.cells) {
        if (cell.intMissing) issues.push({ type: 'missing-internal-layout', itemId: row.id, breakpoint: cell.bp });
        if (cell.mismatch) issues.push({ type: 'external-internal-mismatch', itemId: row.id, breakpoint: cell.bp });
      }
    }

    const external = this.externalItems();

    const snapshot = {
      timestamp: new Date().toISOString(),
      activeBreakpoint: this.activeBreakpoint(),
      containerWidth: this.containerWidth(),
      breakpoints: this.breakpoints(),
      internalItems: this.items().map((i) => ({ id: i.id, type: i.type, layout: i.layout })),
      activeLayout: this.layout(),
      ...(external ? { externalItems: external.map((i) => ({ id: i.id, type: i.type, layout: i.layout })) } : {}),
      issues,
    };

    copyToClipboard(JSON.stringify(snapshot, null, 2))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();

    this.copied.set(true);
    timer(2000)
      .pipe(
        tap(() => this.copied.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
}
