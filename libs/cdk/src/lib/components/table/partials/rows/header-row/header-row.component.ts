import { CDK_ROW_TEMPLATE, CdkHeaderRow, CdkTableModule } from '@angular/cdk/table';
import { Component, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'et-header-row, tr[et-header-row]',
  template: CDK_ROW_TEMPLATE,
  host: {
    class: 'et-header-row et-data-table__header-row',
    role: 'row',
  },
  encapsulation: ViewEncapsulation.None,
  exportAs: 'etHeaderRow',
  providers: [{ provide: CdkHeaderRow, useExisting: HeaderRowComponent }],
  imports: [CdkTableModule],
})
export class HeaderRowComponent extends CdkHeaderRow {}
