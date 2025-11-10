import { Directive, InjectionToken, TemplateRef, ViewContainerRef, inject } from '@angular/core';

import { CdkPortal } from '@angular/cdk/portal';

export const ACCORDION_HINT_WRAPPER_DIRECTIVE = new InjectionToken<AccordionHintWrapperDirective>(
  'AccordionHintWrapperDirective',
);

@Directive({
  selector: 'ng-template[et-accordion-hint-wrapper]',
  providers: [{ provide: ACCORDION_HINT_WRAPPER_DIRECTIVE, useExisting: AccordionHintWrapperDirective }],
})
export class AccordionHintWrapperDirective extends CdkPortal {
  constructor() {
    const templateRef = inject<TemplateRef<unknown>>(TemplateRef);
    const viewContainerRef = inject(ViewContainerRef);

    super(templateRef, viewContainerRef);
  }
}
