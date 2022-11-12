import { BooleanInput, coerceBooleanProperty } from '@angular/cdk/coercion';
import { Directive, ElementRef, HostBinding, Input } from '@angular/core';

@Directive({
  selector: '[etTabLabelWrapper]',
  standalone: true,
  host: {
    class: 'et-tab-label-wrapper',
  },
})
export class TabLabelWrapperDirective {
  @Input()
  get disabled(): boolean {
    return this._disabled;
  }
  set disabled(value: BooleanInput) {
    this._disabled = coerceBooleanProperty(value);
  }
  private _disabled = false;

  @HostBinding('attr.aria-disabled')
  get attrAriaDisabled() {
    return this.disabled ? 'true' : null;
  }

  constructor(public elementRef: ElementRef) {}

  focus(): void {
    this.elementRef.nativeElement.focus();
  }

  getOffsetLeft(): number {
    return this.elementRef.nativeElement.offsetLeft;
  }

  getOffsetWidth(): number {
    return this.elementRef.nativeElement.offsetWidth;
  }
}
