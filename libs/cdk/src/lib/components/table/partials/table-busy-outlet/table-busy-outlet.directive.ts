import { RowOutlet } from '@angular/cdk/table';
import { Directive, ElementRef, ViewContainerRef, inject } from '@angular/core';

@Directive({ selector: '[tableBusyOutlet]' })
export class TableBusyOutletDirective implements RowOutlet {
  viewContainer = inject(ViewContainerRef);
  elementRef = inject(ElementRef);
}
