import { Directive, InjectionToken } from '@angular/core';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const INPUT_PREFIX_TOKEN = new InjectionToken<InputPrefixDirective>('INPUT_PREFIX_DIRECTIVE_TOKEN');

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Directive({
  selector: '[etInputPrefix]',

  host: {
    class: 'et-input-prefix et-legacy',
  },
  exportAs: 'etInputPrefix',
  providers: [
    {
      provide: INPUT_PREFIX_TOKEN,
      useExisting: InputPrefixDirective,
    },
  ],
})
export class InputPrefixDirective {}
