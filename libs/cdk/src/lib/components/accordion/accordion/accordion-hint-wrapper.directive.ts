import { Directive, InjectionToken } from '@angular/core';

import { CdkPortal } from '@angular/cdk/portal';

export const ACCORDION_HINT_WRAPPER_DIRECTIVE = new InjectionToken<AccordionHintWrapperDirective>(
  'AccordionHintWrapperDirective',
);

@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: 'ng-template[et-accordion-hint-wrapper]',
  providers: [{ provide: ACCORDION_HINT_WRAPPER_DIRECTIVE, useExisting: AccordionHintWrapperDirective }],
})
export class AccordionHintWrapperDirective extends CdkPortal {}
