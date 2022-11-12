import { CDK_ROW_TEMPLATE, CdkRow, CdkTableModule } from '@angular/cdk/table';
import { Component, ChangeDetectionStrategy, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'et-row, tr[et-row]',
  template: CDK_ROW_TEMPLATE,
  host: {
    class: 'et-row et-data-table__row',
    role: 'row',
  },
  changeDetection: ChangeDetectionStrategy.Default,
  encapsulation: ViewEncapsulation.None,
  exportAs: 'etRow',
  providers: [{ provide: CdkRow, useExisting: RowComponent }],
  standalone: true,
  imports: [CdkTableModule],
})
export class RowComponent extends CdkRow {}
