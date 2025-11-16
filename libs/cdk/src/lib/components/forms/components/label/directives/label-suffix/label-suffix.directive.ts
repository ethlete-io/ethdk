import { Directive, HostBinding, booleanAttribute, input } from '@angular/core';

@Directive({
  selector: '[etLabelSuffix]',

  exportAs: 'etLabelSuffix',
})
export class LabelSuffixDirective {
  readonly showToScreenReader = input(false, { transform: booleanAttribute });

  @HostBinding('attr.aria-hidden')
  private get _attrAriaHidden() {
    return this.showToScreenReader() ? null : 'true';
  }
}
