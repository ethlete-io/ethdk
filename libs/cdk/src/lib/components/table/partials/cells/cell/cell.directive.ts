import { CdkCell } from '@angular/cdk/table';
import { Directive } from '@angular/core';

@Directive({
  selector: 'et-cell, td[et-cell]',
  host: {
    class: 'et-cell et-data-table__cell',
  },
})
export class CellDirective extends CdkCell {}
