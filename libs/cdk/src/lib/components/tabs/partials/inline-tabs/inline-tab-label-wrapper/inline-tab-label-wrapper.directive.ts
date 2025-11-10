import { Directive, ElementRef, HostBinding, Input, booleanAttribute, inject } from '@angular/core';
import { ActiveTabUnderlineDirective } from '../../../utils';

@Directive({
  selector: '[etInlineTabLabelWrapper]',

  host: {
    class: 'et-inline-tab-label-wrapper',
  },
  hostDirectives: [{ directive: ActiveTabUnderlineDirective, inputs: ['fitUnderlineToContent'] }],
})
export class InlineTabLabelWrapperDirective {
  public elementRef = inject(ElementRef);

  @Input({ transform: booleanAttribute })
  disabled = false;

  @HostBinding('attr.aria-disabled')
  get attrAriaDisabled() {
    return this.disabled ? 'true' : null;
  }

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
