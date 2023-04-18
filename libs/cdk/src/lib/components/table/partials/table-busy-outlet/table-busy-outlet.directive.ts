import { RowOutlet } from '@angular/cdk/table';
import { Directive, ElementRef, ViewContainerRef } from '@angular/core';

@Directive({ selector: '[tableBusyOutlet]', standalone: true })
export class TableBusyOutletDirective implements RowOutlet {
  constructor(public viewContainer: ViewContainerRef, public elementRef: ElementRef) {}
}
