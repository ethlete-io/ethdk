import { CdkPortal } from '@angular/cdk/portal';
import { Directive, InjectionToken, inject } from '@angular/core';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const TAB_LABEL = new InjectionToken<InlineTabLabelDirective>('TabLabel');

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const TAB = new InjectionToken<unknown>('TAB');

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: '[et-inline-tab-label]',
  providers: [{ provide: TAB_LABEL, useExisting: InlineTabLabelDirective }],

  host: {
    class: 'et-inline-tab-label et-legacy',
  },
})
export class InlineTabLabelDirective extends CdkPortal {
  _closestTab = inject(TAB, { optional: true });
}
