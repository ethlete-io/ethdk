import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, ElementRef, inject, input, viewChild, ViewEncapsulation } from '@angular/core';
import { AnimatableDirective, ProvideColorDirective, createCanAnimateSignal } from '@ethlete/core';
import { FormErrorComponent } from '../form-field/form-error.component';
import { FormFieldDirective, injectFormSupport, wireFormSupport, provideFormSupport } from '../form-field/headless';
import { RangeSliderDirective, SliderThumbDirective, SliderThumbLabelContext, SliderTrackDirective } from './headless';
import { injectSliderLabels } from '../../forms/slider/slider-labels';

@Component({
  selector: 'et-range-slider',
  templateUrl: './range-slider.component.html',
  styleUrl: './range-slider.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [
    AnimatableDirective,
    FormErrorComponent,
    NgTemplateOutlet,
    ProvideColorDirective,
    SliderThumbDirective,
    SliderTrackDirective,
  ],
  providers: [provideFormSupport()],
  hostDirectives: [
    FormFieldDirective,
    {
      directive: RangeSliderDirective,
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
        'minValue',
        'maxValue',
        'step',
        'minDistance',
        'orientation',
        'marks',
        'snapToMarks',
      ],
      outputs: ['valueChange', 'mixedChange', 'touchedChange'],
    },
    { directive: ProvideColorDirective, inputs: ['etProvideColor:color'] },
  ],
  host: {
    class: 'et-range-slider',
    '[attr.data-can-animate]': 'canAnimate.state() || null',
    '[attr.data-error]': 'support.displaysError() || null',
    '[attr.data-disabled]': 'slider.disabled() || null',
    '[attr.data-readonly]': 'slider.readonly() || null',
    '[attr.data-dragging]': 'slider.draggingThumbIndex() !== null || null',
    '[attr.data-mark-labels]': 'hasMarkLabels() || null',
  },
})
export class RangeSliderComponent {
  private sliderLabels = injectSliderLabels();

  public support = injectFormSupport();
  protected slider = inject(RangeSliderDirective);

  /** Accessible name of the start thumb. */
  public startLabel = input<string | null>(null);

  /** Accessible name of the end thumb. */
  public endLabel = input<string | null>(null);

  private errorContentRef = viewChild<ElementRef<HTMLElement>>('errorContent');
  private hintContentRef = viewChild<ElementRef<HTMLElement>>('hintContent');
  private errorAnimatableRef = viewChild<AnimatableDirective>('errorAnimatable');
  private hintAnimatableRef = viewChild<AnimatableDirective>('hintAnimatable');

  /** The string in effect: this instance's `startLabel`, else the domain's label set. */
  protected resolvedStartLabel = computed(() => this.startLabel() ?? this.sliderLabels().minimum);

  /** The string in effect: this instance's `endLabel`, else the domain's label set. */
  protected resolvedEndLabel = computed(() => this.endLabel() ?? this.sliderLabels().maximum);

  /** Labelled ticks need room next to the track - the stylesheet reserves it off this flag. */
  protected hasMarkLabels = computed(() => this.slider.markStops().some((mark) => !!mark.label));
  public canAnimate = createCanAnimateSignal();

  constructor() {
    wireFormSupport(this.support, {
      errorContent: this.errorContentRef,
      hintContent: this.hintContentRef,
      errorAnimatable: this.errorAnimatableRef,
      hintAnimatable: this.hintAnimatableRef,
    });
  }

  protected thumbLabelContext(index: number): SliderThumbLabelContext {
    return { $implicit: this.slider.thumbValues()[index] ?? 0, index };
  }
}
