import { Directive, InjectionToken, TemplateRef, ViewContainerRef, inject } from '@angular/core';

import { CdkPortal } from '@angular/cdk/portal';

export const ACCORDION_LABEL_WRAPPER_DIRECTIVE = new InjectionToken<AccordionLabelWrapperDirective>(
  'AccordionLabelWrapperDirective',
);

@Directive({
  selector: 'ng-template[et-accordion-label-wrapper]',
  providers: [{ provide: ACCORDION_LABEL_WRAPPER_DIRECTIVE, useExisting: AccordionLabelWrapperDirective }],
})
export class AccordionLabelWrapperDirective extends CdkPortal {
  constructor() {
    const templateRef = inject<TemplateRef<unknown>>(TemplateRef);
    const viewContainerRef = inject(ViewContainerRef);

    super(templateRef, viewContainerRef);
  }
}
