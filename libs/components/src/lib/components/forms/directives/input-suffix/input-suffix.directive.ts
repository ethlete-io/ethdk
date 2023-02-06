import { Directive } from '@angular/core';

@Directive({
  selector: '[etInputSuffix]',
  standalone: true,
  host: {
    class: 'et-input-suffix',
  },
  exportAs: 'etInputSuffix',
})
export class InputSuffixDirective {}
