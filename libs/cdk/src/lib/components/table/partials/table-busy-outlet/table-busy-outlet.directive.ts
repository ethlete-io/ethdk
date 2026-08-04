import { RowOutlet } from '@angular/cdk/table';
import { Directive, ElementRef, ViewContainerRef, inject } from '@angular/core';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
// eslint-disable-next-line @angular-eslint/directive-selector
@Directive({ selector: '[tableBusyOutlet]' })
export class TableBusyOutletDirective implements RowOutlet {
  viewContainer = inject(ViewContainerRef);
  elementRef = inject(ElementRef);
}
