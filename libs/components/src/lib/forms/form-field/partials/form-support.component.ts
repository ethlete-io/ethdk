import { Component, ElementRef, viewChild, ViewEncapsulation } from '@angular/core';
import { AnimatableDirective, ProvideColorDirective } from '@ethlete/core';
import { FormErrorComponent } from '../form-error.component';
import { mountFormSupportStyles } from '../form-support-styles.component';
import { FormWarningComponent } from '../form-warning.component';
import { injectFormSupport, wireFormSupport } from '../headless';

/**
 * The support region every non-text control renders under itself: the clipped, height-animated box
 * and the error / warning / hint blocks that cross-fade inside it, wired to the enclosing
 * `injectFormSupport`. Project the control's `et-hint` into it - the hint slot has to stay
 * selector-less, because a re-projected `<ng-content>` never matches a `select`.
 *
 * Render it behind the region gate the support state machine provides, so the box only exists while
 * it has something to show:
 *
 * ```html
 * @if (support.shouldRenderSupport()) {
 *   <et-form-support><ng-content select="et-hint" /></et-form-support>
 * }
 * ```
 *
 * @internal
 */
@Component({
  selector: 'et-form-support',
  templateUrl: './form-support.component.html',
  encapsulation: ViewEncapsulation.None,
  imports: [AnimatableDirective, FormErrorComponent, FormWarningComponent, ProvideColorDirective],
  host: {
    class: 'et-form-support',
    '[style.block-size.px]': 'support.supportHeight()',
  },
})
export class FormSupportComponent {
  public support = injectFormSupport();

  private errorContent = viewChild<ElementRef<HTMLElement>>('errorContent');
  private warningContent = viewChild<ElementRef<HTMLElement>>('warningContent');
  private hintContent = viewChild<ElementRef<HTMLElement>>('hintContent');
  private errorAnimatable = viewChild<AnimatableDirective>('errorAnimatable');
  private warningAnimatable = viewChild<AnimatableDirective>('warningAnimatable');
  private hintAnimatable = viewChild<AnimatableDirective>('hintAnimatable');

  constructor() {
    // ahead of the region's own view, so the rules and the `@property` registrations its
    // transitions animate are in the document before the first element that needs them
    mountFormSupportStyles();

    wireFormSupport(this.support, {
      errorContent: this.errorContent,
      warningContent: this.warningContent,
      hintContent: this.hintContent,
      errorAnimatable: this.errorAnimatable,
      warningAnimatable: this.warningAnimatable,
      hintAnimatable: this.hintAnimatable,
    });
  }
}
