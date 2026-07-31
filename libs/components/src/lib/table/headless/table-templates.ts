import { DestroyRef, Directive, inject, input, Signal, TemplateRef } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { TABLE_ERROR_CODES } from '../table-errors';
import { TableComponent } from '../table.component';
import {
  AnyTableColumn,
  TableCellContext,
  TableCellEditContext,
  TableCellSkeletonContext,
  TableColumn,
  TableColumnTemplate,
  TableFilterOptionContext,
  TableFooterContext,
  TableHeaderContext,
  TableTemplateSlot,
} from '../table.types';

/**
 * Register the host `<ng-template>` with the table it sits in. Shared by the three column-template
 * directives below; the table keeps them in a registry rather than querying for them.
 */
const registerColumnTemplate = ({
  slot,
  name,
  column,
}: {
  slot: TableTemplateSlot;
  /** The directive's selector, for the error message when it sits outside a table. */
  name: string;
  column: Signal<object>;
}) => {
  const table = inject(TableComponent, { optional: true });

  if (!table) {
    throw new RuntimeError(
      TABLE_ERROR_CODES.TEMPLATE_OUTSIDE_TABLE,
      `[${name}] must be used on an <ng-template> inside an <et-table>.`,
    );
  }

  const registration: TableColumnTemplate = { slot, column, template: inject(TemplateRef) };

  table.registerColumnTemplate(registration);
  inject(DestroyRef).onDestroy(() => table.unregisterColumnTemplate(registration));
};

/**
 * Custom body-cell content for one column. Bind the column from your `TableColumns` record and the
 * context is typed from it — `let-row` is the row type and `let-value` the column's `value` type,
 * inferred, not declared.
 *
 * @example
 * <et-table [data]="users()" [columns]="COLUMNS">
 *   <ng-template [etTableCell]="COLUMNS.role" let-row let-value="value">
 *     <et-chip>{{ value }}</et-chip>
 *   </ng-template>
 * </et-table>
 */
@Directive({
  selector: 'ng-template[etTableCell]',
  exportAs: 'etTableCell',
})
export class TableCellDirective<T, TValue> {
  /** The column whose body cells this template renders. */
  public column = input.required<TableColumn<T, TValue>>({ alias: 'etTableCell' });

  constructor() {
    registerColumnTemplate({ slot: 'cell', name: 'etTableCell', column: this.column });
  }

  // static on purpose (the lint ban excepts it): Angular's template type checker requires the
  // context guard to be static — it types the `let-` bindings of the host ng-template.
  public static ngTemplateContextGuard<T, TValue>(
    _directive: TableCellDirective<T, TValue>,
    _context: unknown,
  ): _context is TableCellContext<T, TValue> {
    return true;
  }
}

/**
 * Custom header content for one column, replacing its `header` text. `let-header` is that text, so
 * a template can decorate it rather than restate it.
 *
 * @example
 * <ng-template [etTableHeaderCell]="COLUMNS.role" let-header>
 *   {{ header }} <i etIcon="et-info"></i>
 * </ng-template>
 */
@Directive({
  selector: 'ng-template[etTableHeaderCell]',
  exportAs: 'etTableHeaderCell',
})
export class TableHeaderCellDirective<T> {
  /** The column whose header cell this template renders. */
  public column = input.required<AnyTableColumn<T>>({ alias: 'etTableHeaderCell' });

  constructor() {
    registerColumnTemplate({ slot: 'header', name: 'etTableHeaderCell', column: this.column });
  }

  public static ngTemplateContextGuard<T>(
    _directive: TableHeaderCellDirective<T>,
    _context: unknown,
  ): _context is TableHeaderContext {
    return true;
  }
}

/**
 * Custom content for one column's filter options — a flag beside a country, a subtitle under a name,
 * an avatar. `let-option` is the option (`label`, `value`, and anything else you put on it) and
 * `let-selected` says whether it is currently picked; the menu still owns the row, its checkbox/radio
 * mark and its keyboard behaviour.
 *
 * Needs `TABLE_FILTER_IMPORTS` on the table — without the filter feature there is no menu to render
 * into, and the template simply goes unused.
 *
 * @example
 * <ng-template [etTableFilterOption]="COLUMNS.country" let-option>
 *   <img [src]="option.flag" alt="" /> {{ option.label }}
 * </ng-template>
 */
@Directive({
  selector: 'ng-template[etTableFilterOption]',
  exportAs: 'etTableFilterOption',
})
export class TableFilterOptionDirective<T> {
  /** The column whose filter options this template renders. */
  public column = input.required<AnyTableColumn<T>>({ alias: 'etTableFilterOption' });

  constructor() {
    registerColumnTemplate({ slot: 'filterOption', name: 'etTableFilterOption', column: this.column });
  }

  public static ngTemplateContextGuard<T>(
    _directive: TableFilterOptionDirective<T>,
    _context: unknown,
  ): _context is TableFilterOptionContext {
    return true;
  }
}

/**
 * What one column's cells look like while the table is loading with no rows yet. Without it the table
 * draws a line-of-text bone, which is right for text and wrong for anything taller — a chip, an avatar,
 * a button. Since the placeholder rows exist to keep the layout still, a column whose cells are taller
 * than text should say so here, or the table will resize when the data lands.
 *
 * `let-index` is the placeholder row's index and `let-width` the width the default bone would have used.
 *
 * @example
 * <!-- the Role column renders a chip, so its placeholder is chip-shaped -->
 * <ng-template [etTableCellSkeleton]="COLUMNS.role">
 *   <et-skeleton-item shape="rect" style="inline-size: 64px; block-size: 24px; --et-skeleton-radius: 999px" />
 * </ng-template>
 */
@Directive({
  selector: 'ng-template[etTableCellSkeleton]',
  exportAs: 'etTableCellSkeleton',
})
export class TableCellSkeletonDirective<T> {
  /** The column whose loading placeholder this template renders. */
  public column = input.required<AnyTableColumn<T>>({ alias: 'etTableCellSkeleton' });

  constructor() {
    registerColumnTemplate({ slot: 'cellSkeleton', name: 'etTableCellSkeleton', column: this.column });
  }

  public static ngTemplateContextGuard<T>(
    _directive: TableCellSkeletonDirective<T>,
    _context: unknown,
  ): _context is TableCellSkeletonContext {
    return true;
  }
}

/**
 * The editor one column's cells swap to while they are being edited in place — what makes a column
 * marked `editable` actually editable. Needs `etTableInlineEdit` on the table.
 *
 * `let-field` is the draft, as a signal-forms field: bind it with `[formField]` and the control saves
 * into it, exactly as it would in a form. `let-row` is the row and `let-value` the value editing started
 * from. Committing is the table's (Enter, Tab); the template only renders the control.
 *
 * @example
 * <ng-template [etTableCellEdit]="COLUMNS.name" let-field="field">
 *   <et-form-field size="sm">
 *     <et-input [formField]="field" aria-label="Name" />
 *   </et-form-field>
 * </ng-template>
 */
@Directive({
  selector: 'ng-template[etTableCellEdit]',
  exportAs: 'etTableCellEdit',
})
export class TableCellEditDirective<T, TValue> {
  /** The column whose cells this template edits. */
  public column = input.required<TableColumn<T, TValue>>({ alias: 'etTableCellEdit' });

  constructor() {
    registerColumnTemplate({ slot: 'cellEdit', name: 'etTableCellEdit', column: this.column });
  }

  public static ngTemplateContextGuard<T, TValue>(
    _directive: TableCellEditDirective<T, TValue>,
    _context: unknown,
  ): _context is TableCellEditContext<T, TValue> {
    return true;
  }
}

/**
 * A footer cell for one column — a totals/summary row. `let-rows` is every rendered row (typed),
 * so the cell can aggregate them. Any column with one shows the table's sticky footer row.
 *
 * @example
 * <ng-template [etTableFooterCell]="COLUMNS.amount" let-rows>
 *   {{ total(rows) | currency }}
 * </ng-template>
 */
@Directive({
  selector: 'ng-template[etTableFooterCell]',
  exportAs: 'etTableFooterCell',
})
export class TableFooterCellDirective<T> {
  /** The column whose footer cell this template renders. */
  public column = input.required<AnyTableColumn<T>>({ alias: 'etTableFooterCell' });

  constructor() {
    registerColumnTemplate({ slot: 'footer', name: 'etTableFooterCell', column: this.column });
  }

  public static ngTemplateContextGuard<T>(
    _directive: TableFooterCellDirective<T>,
    _context: unknown,
  ): _context is TableFooterContext<T> {
    return true;
  }
}
