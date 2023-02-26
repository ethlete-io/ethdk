import { Directive, InjectionToken } from '@angular/core';

export const INPUT_SUFFIX_TOKEN = new InjectionToken<InputSuffixDirective>('INPUT_SUFFIX_DIRECTIVE_TOKEN');

@Directive({
  selector: '[etInputSuffix]',
  standalone: true,
  host: {
    class: 'et-input-suffix',
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
