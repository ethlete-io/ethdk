import { CdkRow, CdkTableModule, CDK_ROW_TEMPLATE } from '@angular/cdk/table';
import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'et-row, [et-row], [et-row]',
  template: CDK_ROW_TEMPLATE,
  host: {
    class: 'et-row et-data-table__row',
    role: 'row',
  },
  changeDetection: ChangeDetectionStrategy.Default,
  encapsulation: ViewEncapsulation.None,
  exportAs: 'etRow',
  providers: [{ provide: CdkRow, useExisting: RowComponent }],
  imports: [CdkTableModule],
})
export class RowComponent extends CdkRow {}
