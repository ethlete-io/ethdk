import { NgTemplateOutlet } from '@angular/common';
import { Component, ViewEncapsulation, computed, inject } from '@angular/core';
import { ProvideColorDirective, createCanAnimateSignal } from '@ethlete/core';
import { FormSupportComponent } from '../form-field/partials/form-support.component';
import {
  ACCESSIBLE_NAME_INPUTS,
  FormFieldDirective,
  injectFormSupport,
  provideFormSupport,
} from '../form-field/headless';
import { SliderDirective, SliderThumbDirective, SliderThumbLabelContext, SliderTrackDirective } from './headless';
import { FIELD_STATE_INPUTS } from '../form-field/headless/field-state-control.directive';

@Component({
  selector: 'et-slider',
  templateUrl: './slider.component.html',
  styleUrl: './slider.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [FormSupportComponent, NgTemplateOutlet, SliderThumbDirective, SliderTrackDirective],
  providers: [provideFormSupport()],
  hostDirectives: [
    FormFieldDirective,
    {
      directive: SliderDirective,
      inputs: [
        'value',
        'mixed',
        'mixedLabel',
        'touched',
        'disabled',
        'readonly',
        'invalid',
        'errors',
        'required',
        'name',
        'min',
        'max',
        'step',
        'orientation',
        'marks',
        'snapToMarks',
        ...ACCESSIBLE_NAME_INPUTS,
        ...FIELD_STATE_INPUTS,
      ],
      outputs: ['valueChange', 'mixedChange', 'touchedChange', 'touch'],
    },
    { directive: ProvideColorDirective, inputs: ['etProvideColor:color'] },
  ],
  host: {
    class: 'et-slider',
    '[style.display]': 'slider.hidden() ? "none" : null',
    '[attr.data-can-animate]': 'canAnimate.state() || null',
    '[attr.data-error]': 'support.displaysError() || null',
    '[attr.data-warning]': 'support.displaysWarning() || null',
    '[attr.data-disabled]': 'slider.disabled() || null',
    '[attr.data-readonly]': 'slider.readonly() || null',
    '[attr.data-dragging]': 'slider.draggingThumbIndex() !== null || null',
    '[attr.data-mark-labels]': 'hasMarkLabels() || null',
  },
})
export class SliderComponent {
  public support = injectFormSupport();
  protected slider = inject(SliderDirective);

  /** Labelled ticks need room next to the track - the stylesheet reserves it off this flag. */
  protected hasMarkLabels = computed(() => this.slider.markStops().some((mark) => !!mark.label));
  public canAnimate = createCanAnimateSignal();

  protected thumbLabelContext(index: number): SliderThumbLabelContext {
    return { $implicit: this.slider.thumbValues()[index] ?? 0, index };
  }

  public focus(options?: FocusOptions) {
    this.slider.focus(options);
  }
}
