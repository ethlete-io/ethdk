import { CdkPortal } from '@angular/cdk/portal';
import { Directive, TemplateRef, ViewContainerRef } from '@angular/core';
import { ACCORDION_LABEL_WRAPPER_DIRECTIVE } from './accordion-label-wrapper.directive.constants';

@Directive({
  selector: 'ng-template[et-accordion-label-wrapper]',
  providers: [{ provide: ACCORDION_LABEL_WRAPPER_DIRECTIVE, useExisting: AccordionLabelWrapperDirective }],
  standalone: true,
})
export class AccordionLabelWrapperDirective extends CdkPortal {
  constructor(templateRef: TemplateRef<unknown>, viewContainerRef: ViewContainerRef) {
    super(templateRef, viewContainerRef);
  }
}
