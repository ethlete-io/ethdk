import { Directive } from '@angular/core';

@Directive({
  selector: '[etInputPrefix]',
  standalone: true,
  host: {
    class: 'et-input-prefix',
  },
  exportAs: 'etInputPrefix',
})
export class InputPrefixDirective {}
