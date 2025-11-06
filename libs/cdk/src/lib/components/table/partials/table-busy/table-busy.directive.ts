import { Directive, TemplateRef, inject } from '@angular/core';

@Directive({
  selector: 'ng-template[etTableBusy]',
  standalone: true,
})
export class TableBusyDirective {
  templateRef = inject(TemplateRef);

  _contentClassName = 'et-table-busy';
}
