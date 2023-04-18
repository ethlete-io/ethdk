import { Directive, TemplateRef } from '@angular/core';

@Directive({
  selector: 'ng-template[etTableBusy]',
  standalone: true,
})
export class TableBusyDirective {
  _contentClassName = 'et-table-busy';

  constructor(public templateRef: TemplateRef<unknown>) {}
}
