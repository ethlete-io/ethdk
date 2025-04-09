import { Directive, InjectionToken, TemplateRef, ViewContainerRef } from '@angular/core';

import { CdkPortal } from '@angular/cdk/portal';

export const ACCORDION_LABEL_WRAPPER_DIRECTIVE = new InjectionToken<AccordionLabelWrapperDirective>(
  'AccordionLabelWrapperDirective',
);

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
