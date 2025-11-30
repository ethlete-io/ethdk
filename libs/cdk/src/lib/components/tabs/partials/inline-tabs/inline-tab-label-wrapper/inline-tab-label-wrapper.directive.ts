import { Directive, ElementRef, Input, booleanAttribute, inject } from '@angular/core';
import { ActiveTabUnderlineDirective } from '../../../utils';

@Directive({
  selector: '[etInlineTabLabelWrapper]',
  host: {
    class: 'et-inline-tab-label-wrapper',
    '[attr.aria-disabled]': 'disabled ? "true" : null',
  },
  hostDirectives: [{ directive: ActiveTabUnderlineDirective, inputs: ['fitUnderlineToContent'] }],
})
export class InlineTabLabelWrapperDirective {
  public elementRef = inject(ElementRef);

  @Input({ transform: booleanAttribute })
  disabled = false;

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
