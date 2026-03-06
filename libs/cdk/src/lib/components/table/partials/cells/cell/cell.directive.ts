import { CdkCell } from '@angular/cdk/table';
import { Directive } from '@angular/core';

@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: 'et-cell, td[et-cell]',
  host: {
    class: 'et-cell et-data-table__cell',
  },
})
export class CellDirective extends CdkCell {}
