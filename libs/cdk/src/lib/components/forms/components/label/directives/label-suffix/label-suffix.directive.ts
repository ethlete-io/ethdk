import { Directive, HostBinding, Input, booleanAttribute } from '@angular/core';

@Directive({
  selector: '[etLabelSuffix]',

  exportAs: 'etLabelSuffix',
})
export class LabelSuffixDirective {
  @Input({ transform: booleanAttribute })
  showToScreenReader = false;

  @HostBinding('attr.aria-hidden')
  private get _attrAriaHidden() {
    return this.showToScreenReader ? null : 'true';
  }
}
