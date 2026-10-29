import { Directive } from '@angular/core';

@Directive({
  selector: 'et-table[recycleRows], table[et-table][recycleRows]',
  standalone: true,
})
export class RecycleRowsDirective {}
