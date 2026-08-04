import { Directive, ElementRef, Input, booleanAttribute, inject } from '@angular/core';
import { ActiveTabUnderlineDirective } from '../../../utils';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Directive({
  selector: '[etInlineTabLabelWrapper]',
  host: {
    class: 'et-inline-tab-label-wrapper et-legacy',
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
