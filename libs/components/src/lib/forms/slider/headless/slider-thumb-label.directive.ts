import { Directive, TemplateRef, afterNextRender, inject } from '@angular/core';
import { registerSingleton } from '../../form-field/headless';
import { injectHostElement, RuntimeError } from '@ethlete/core';
import { SLIDER_ERROR_CODES } from '../slider-errors';
import { SLIDER_TOKEN, SliderThumbLabelBase, SliderThumbLabelContext } from './slider.tokens';

/** Opts the slider into value labels - rendered once per thumb with its current value. */
@Directive({
  selector: 'ng-template[etSliderThumbLabel]',
  exportAs: 'etSliderThumbLabel',
})
export class SliderThumbLabelDirective implements SliderThumbLabelBase {
  private slider = inject(SLIDER_TOKEN, { optional: true });
  public templateRef = inject<TemplateRef<SliderThumbLabelContext>>(TemplateRef);
  private hostElement = injectHostElement<Comment>();

  constructor() {
    registerSingleton(this.slider?.registeredThumbLabelTemplate, this);

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.slider) {
          throw new RuntimeError(
            SLIDER_ERROR_CODES.THUMB_LABEL_OUTSIDE_SLIDER,
            'An ng-template[etSliderThumbLabel] must be placed inside an [etSlider] or [etRangeSlider].',
            { element: this.hostElement },
          );
        }
      });
    }
  }
}
