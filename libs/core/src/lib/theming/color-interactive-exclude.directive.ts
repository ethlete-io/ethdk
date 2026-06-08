import { Directive } from '@angular/core';

@Directive({
  selector: '[etColorInteractiveExclude]',
  host: {
    class: 'et-color-interactive-exclude',
  },
})
export class ColorInteractiveExcludeDirective {}
