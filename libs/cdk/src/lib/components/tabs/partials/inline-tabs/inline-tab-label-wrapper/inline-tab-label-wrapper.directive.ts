import { Directive, ElementRef, HostBinding, Input, booleanAttribute } from '@angular/core';
import { ActiveTabUnderlineDirective } from '../../../utils';

@Directive({
  selector: '[etInlineTabLabelWrapper]',
  standalone: true,
  host: {
    class: 'et-inline-tab-label-wrapper',
  },
  hostDirectives: [{ directive: ActiveTabUnderlineDirective, inputs: ['fitUnderlineToContent'] }],
})
export class InlineTabLabelWrapperDirective {
  @Input({ transform: booleanAttribute })
  disabled = false;

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
