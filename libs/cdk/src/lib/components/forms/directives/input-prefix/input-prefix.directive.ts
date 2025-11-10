import { Directive, InjectionToken } from '@angular/core';

export const INPUT_PREFIX_TOKEN = new InjectionToken<InputPrefixDirective>('INPUT_PREFIX_DIRECTIVE_TOKEN');

@Directive({
  selector: '[etInputPrefix]',

  host: {
    class: 'et-input-prefix',
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
