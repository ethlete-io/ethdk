import { CDK_ROW_TEMPLATE, CdkFooterRow, CdkTableModule } from '@angular/cdk/table';
import { Component, ChangeDetectionStrategy, ViewEncapsulation } from '@angular/core';

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
  imports: [CdkTableModule],
})
export class FooterRowComponent extends CdkFooterRow {}
