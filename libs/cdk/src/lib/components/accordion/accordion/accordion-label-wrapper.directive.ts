import { Directive, InjectionToken } from '@angular/core';

import { CdkPortal } from '@angular/cdk/portal';

export const ACCORDION_LABEL_WRAPPER_DIRECTIVE = new InjectionToken<AccordionLabelWrapperDirective>(
  'AccordionLabelWrapperDirective',
);

@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: 'ng-template[et-accordion-label-wrapper]',
  providers: [{ provide: ACCORDION_LABEL_WRAPPER_DIRECTIVE, useExisting: AccordionLabelWrapperDirective }],
})
export class AccordionLabelWrapperDirective extends CdkPortal {}
