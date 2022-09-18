import {
  CDK_ROW_TEMPLATE,
  CdkFooterRow,
  CdkFooterRowDef,
  CdkHeaderRow,
  CdkHeaderRowDef,
  CdkRow,
  CdkRowDef,
  CdkNoDataRow,
} from '@angular/cdk/table';
import { ChangeDetectionStrategy, Component, Directive, ViewEncapsulation } from '@angular/core';

@Directive({
  selector: '[etHeaderRowDef]',
  providers: [{ provide: CdkHeaderRowDef, useExisting: HeaderRowDefDirective }],
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['columns: etHeaderRowDef', 'sticky: etHeaderRowDefSticky'],
})
export class HeaderRowDefDirective extends CdkHeaderRowDef {}

@Directive({
  selector: '[etFooterRowDef]',
  providers: [{ provide: CdkFooterRowDef, useExisting: FooterRowDefDirective }],
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['columns: etFooterRowDef', 'sticky: etFooterRowDefSticky'],
})
export class FooterRowDefDirective extends CdkFooterRowDef {}

@Directive({
  selector: '[etRowDef]',
  providers: [{ provide: CdkRowDef, useExisting: RowDefDirective }],
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['columns: etRowDefColumns', 'when: etRowDefWhen'],
})
export class RowDefDirective<T> extends CdkRowDef<T> {}

@Component({
  selector: 'et-header-row, tr[et-header-row]',
  template: CDK_ROW_TEMPLATE,
  host: {
    class: 'et-header-row et-data-table__header-row',
    role: 'row',
  },
  changeDetection: ChangeDetectionStrategy.Default,
  encapsulation: ViewEncapsulation.None,
  exportAs: 'etHeaderRow',
  providers: [{ provide: CdkHeaderRow, useExisting: HeaderRowComponent }],
})
export class HeaderRowComponent extends CdkHeaderRow {}

@Component({
  selector: 'et-footer-row, tr[et-footer-row]',
  template: CDK_ROW_TEMPLATE,
  host: {
    class: 'et-footer-row et-data-table__row',
    role: 'row',
  },
  changeDetection: ChangeDetectionStrategy.Default,
  encapsulation: ViewEncapsulation.None,
  exportAs: 'etFooterRow',
  providers: [{ provide: CdkFooterRow, useExisting: FooterRowComponent }],
})
export class FooterRowComponent extends CdkFooterRow {}

@Component({
  selector: 'et-row, tr[et-row]',
  template: CDK_ROW_TEMPLATE,
  host: {
    class: 'et-row mdc-data-table__row',
    role: 'row',
  },
  changeDetection: ChangeDetectionStrategy.Default,
  encapsulation: ViewEncapsulation.None,
  exportAs: 'etRow',
  providers: [{ provide: CdkRow, useExisting: RowComponent }],
})
export class RowComponent extends CdkRow {}

@Directive({
  selector: 'ng-template[etNoDataRow]',
  providers: [{ provide: CdkNoDataRow, useExisting: NoDataRowDirective }],
})
export class NoDataRowDirective extends CdkNoDataRow {
  override _contentClassName = 'et-no-data-row';
}
