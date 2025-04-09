import { Directive, InjectionToken, TemplateRef, ViewContainerRef } from '@angular/core';

import { CdkPortal } from '@angular/cdk/portal';

export const ACCORDION_HINT_WRAPPER_DIRECTIVE = new InjectionToken<AccordionHintWrapperDirective>(
  'AccordionHintWrapperDirective',
);

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
