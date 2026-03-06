import { RowOutlet } from '@angular/cdk/table';
import { Directive, ElementRef, ViewContainerRef, inject } from '@angular/core';

// eslint-disable-next-line @angular-eslint/directive-selector
@Directive({ selector: '[tableBusyOutlet]' })
export class TableBusyOutletDirective implements RowOutlet {
  viewContainer = inject(ViewContainerRef);
  elementRef = inject(ElementRef);
}
