import { Directive, booleanAttribute, input } from '@angular/core';

@Directive({
  selector: '[etLabelSuffix]',
  exportAs: 'etLabelSuffix',
  host: {
    '[attr.aria-hidden]': 'this.showToScreenReader() ? null : "true"',
  },
})
export class LabelSuffixDirective {
  readonly showToScreenReader = input(false, { transform: booleanAttribute });
}
