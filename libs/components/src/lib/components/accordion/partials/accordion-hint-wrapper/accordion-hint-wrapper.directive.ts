import { CdkPortal } from '@angular/cdk/portal';
import { Directive, TemplateRef, ViewContainerRef } from '@angular/core';
import { ACCORDION_HINT_WRAPPER_DIRECTIVE } from './accordion-hint-wrapper.directive.constants';

@Directive({
  selector: 'ng-template[et-accordion-hint-wrapper]',
  providers: [{ provide: ACCORDION_HINT_WRAPPER_DIRECTIVE, useExisting: AccordionHintWrapperDirective }],
  standalone: true,
})
export class AccordionHintWrapperDirective extends CdkPortal {
  constructor(templateRef: TemplateRef<unknown>, viewContainerRef: ViewContainerRef) {
    super(templateRef, viewContainerRef);
  }
}
