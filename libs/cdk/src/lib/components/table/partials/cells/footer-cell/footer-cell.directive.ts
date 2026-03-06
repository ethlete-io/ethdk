import { CdkFooterCell } from '@angular/cdk/table';
import { Directive } from '@angular/core';

@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: 'et-footer-cell, td[et-footer-cell]',
  host: {
    class: 'et-footer-cell et-data-table__cell',
  },
})
export class FooterCellDirective extends CdkFooterCell {}
