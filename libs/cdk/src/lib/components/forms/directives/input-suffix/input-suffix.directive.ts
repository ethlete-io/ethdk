import { Directive, InjectionToken } from '@angular/core';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const INPUT_SUFFIX_TOKEN = new InjectionToken<InputSuffixDirective>('INPUT_SUFFIX_DIRECTIVE_TOKEN');

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Directive({
  selector: '[etInputSuffix]',

  host: {
    class: 'et-input-suffix et-legacy',
  },
  exportAs: 'etInputSuffix',
  providers: [
    {
      provide: INPUT_SUFFIX_TOKEN,
      useExisting: InputSuffixDirective,
    },
  ],
})
export class InputSuffixDirective {}
