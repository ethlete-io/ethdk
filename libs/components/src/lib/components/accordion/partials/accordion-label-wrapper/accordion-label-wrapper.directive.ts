import { CdkPortal } from '@angular/cdk/portal';
import { Directive, InjectionToken, TemplateRef, ViewContainerRef } from '@angular/core';

export const ACCORDION_LABEL_WRAPPER = new InjectionToken<AccordionLabelWrapperDirective>('AccordionLabelWrapper');

@Directive({
  selector: 'ng-template[et-accordion-label-wrapper]',
  providers: [{ provide: ACCORDION_LABEL_WRAPPER, useExisting: AccordionLabelWrapperDirective }],
  standalone: true,
})
export class AccordionLabelWrapperDirective extends CdkPortal {
  constructor(templateRef: TemplateRef<unknown>, viewContainerRef: ViewContainerRef) {
    super(templateRef, viewContainerRef);
  }
}
