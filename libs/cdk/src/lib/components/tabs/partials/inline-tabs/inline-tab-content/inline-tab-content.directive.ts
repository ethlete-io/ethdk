import { Directive, InjectionToken, TemplateRef, inject } from '@angular/core';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const TAB_CONTENT = new InjectionToken<InlineTabContentDirective>('TabContent');

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Directive({
  selector: '[etInlineTabContent]',
  providers: [{ provide: TAB_CONTENT, useExisting: InlineTabContentDirective }],

  host: {
    class: 'et-inline-tab-content et-legacy',
  },
})
export class InlineTabContentDirective {
  template = inject(TemplateRef);
}
