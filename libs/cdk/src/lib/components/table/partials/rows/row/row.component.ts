import { CDK_ROW_TEMPLATE, CdkRow, CdkTableModule } from '@angular/cdk/table';
import { Component, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'et-row, [et-row], [et-row]',
  template: CDK_ROW_TEMPLATE,
  host: {
    class: 'et-row et-data-table__row',
    role: 'row',
  },
  encapsulation: ViewEncapsulation.None,
  exportAs: 'etRow',
  providers: [{ provide: CdkRow, useExisting: RowComponent }],
  imports: [CdkTableModule],
})
export class RowComponent extends CdkRow {}
