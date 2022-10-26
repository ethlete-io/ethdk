import { CdkPortal } from '@angular/cdk/portal';
import { Directive, InjectionToken, TemplateRef, ViewContainerRef } from '@angular/core';

export const ACCORDION_HINT_WRAPPER = new InjectionToken<AccordionHintWrapperDirective>('AccordionHintWrapper');

@Directive({
  selector: 'ng-template[et-accordion-hint-wrapper]',
  providers: [{ provide: ACCORDION_HINT_WRAPPER, useExisting: AccordionHintWrapperDirective }],
  standalone: true,
})
export class AccordionHintWrapperDirective extends CdkPortal {
  constructor(templateRef: TemplateRef<unknown>, viewContainerRef: ViewContainerRef) {
    super(templateRef, viewContainerRef);
  }
}
