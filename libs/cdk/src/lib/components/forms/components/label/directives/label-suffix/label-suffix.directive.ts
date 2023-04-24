import { BooleanInput, coerceBooleanProperty } from '@angular/cdk/coercion';
import { Directive, HostBinding, Input } from '@angular/core';

@Directive({
  selector: '[etLabelSuffix]',
  standalone: true,
  exportAs: 'etLabelSuffix',
})
export class LabelSuffixDirective {
  @Input()
  get showToScreenReader(): boolean {
    return this._showToScreenReader;
  }
  set showToScreenReader(value: BooleanInput) {
    this._showToScreenReader = coerceBooleanProperty(value);
  }
  private _showToScreenReader = false;

  @HostBinding('attr.aria-hidden')
  private get _attrAriaHidden() {
    return this.showToScreenReader ? null : 'true';
  }
}
