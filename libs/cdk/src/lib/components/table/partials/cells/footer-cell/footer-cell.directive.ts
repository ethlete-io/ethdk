import { CdkFooterCell } from '@angular/cdk/table';
import { Directive } from '@angular/core';

@Directive({
  selector: 'et-footer-cell, td[et-footer-cell]',
  host: {
    class: 'et-footer-cell et-data-table__cell',
  },
  standalone: true,
})
export class FooterCellDirective extends CdkFooterCell {}
