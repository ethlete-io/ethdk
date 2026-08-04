import { Directive, InjectionToken } from '@angular/core';

import { CdkPortal } from '@angular/cdk/portal';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const ACCORDION_LABEL_WRAPPER_DIRECTIVE = new InjectionToken<AccordionLabelWrapperDirective>(
  'AccordionLabelWrapperDirective',
);

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: 'ng-template[et-accordion-label-wrapper]',
  providers: [{ provide: ACCORDION_LABEL_WRAPPER_DIRECTIVE, useExisting: AccordionLabelWrapperDirective }],
})
export class AccordionLabelWrapperDirective extends CdkPortal {}
