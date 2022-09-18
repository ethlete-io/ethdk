import { Directive, InjectionToken, Input } from '@angular/core';
import {
  CdkCell,
  CdkCellDef,
  CdkColumnDef,
  CdkFooterCell,
  CdkFooterCellDef,
  CdkHeaderCell,
  CdkHeaderCellDef,
} from '@angular/cdk/table';

@Directive({
  selector: '[etCellDef]',
  providers: [{ provide: CdkCellDef, useExisting: CellDefDirective }],
})
export class CellDefDirective extends CdkCellDef {}

@Directive({
  selector: '[etHeaderCellDef]',
  providers: [{ provide: CdkHeaderCellDef, useExisting: HeaderCellDefDirective }],
})
export class HeaderCellDefDirective extends CdkHeaderCellDef {}

@Directive({
  selector: '[etFooterCellDef]',
  providers: [{ provide: CdkFooterCellDef, useExisting: FooterCellDefDirective }],
})
export class FooterCellDefDirective extends CdkFooterCellDef {}

export const SORT_HEADER_COLUMN_DEF = new InjectionToken<CdkColumnDef>('SortHeaderColumnDef');

@Directive({
  selector: '[etColumnDef]',
  providers: [
    { provide: CdkColumnDef, useExisting: ColumnDefDirective },
    { provide: SORT_HEADER_COLUMN_DEF, useExisting: ColumnDefDirective },
  ],
})
export class ColumnDefDirective extends CdkColumnDef {
  @Input('etColumnDef')
  override get name(): string {
    return this._name;
  }
  override set name(name: string) {
    this._setNameInput(name);
  }

  protected override _updateColumnCssClassName() {
    super._updateColumnCssClassName();
    this._columnCssClassName?.push(`et-column-${this.cssClassFriendlyName}`);
  }
}

@Directive({
  selector: 'et-header-cell, th[et-header-cell]',
  host: {
    class: 'et-header-cell et-data-table__header-cell',
    role: 'columnheader',
  },
})
export class HeaderCellDirective extends CdkHeaderCell {}

@Directive({
  selector: 'et-footer-cell, td[et-footer-cell]',
  host: {
    class: 'et-footer-cell et-data-table__cell',
  },
})
export class FooterCellDirective extends CdkFooterCell {}

@Directive({
  selector: 'et-cell, td[et-cell]',
  host: {
    class: 'et-cell et-data-table__cell',
  },
})
export class CellDirective extends CdkCell {}
