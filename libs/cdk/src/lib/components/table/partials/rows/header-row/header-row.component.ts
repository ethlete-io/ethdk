import { CdkHeaderRow, CdkTableModule, CDK_ROW_TEMPLATE } from '@angular/cdk/table';
import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';

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
  imports: [CdkTableModule],
})
export class HeaderRowComponent extends CdkHeaderRow {}
