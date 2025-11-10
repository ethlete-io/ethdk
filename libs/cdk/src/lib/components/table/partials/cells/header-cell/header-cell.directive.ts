import { CdkHeaderCell } from '@angular/cdk/table';
import { Directive } from '@angular/core';

@Directive({
  selector: 'et-header-cell, th[et-header-cell]',
  host: {
    class: 'et-header-cell et-data-table__header-cell',
    role: 'columnheader',
  },
})
export class HeaderCellDirective extends CdkHeaderCell {}
