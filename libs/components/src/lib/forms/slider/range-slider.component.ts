import { NgTemplateOutlet } from '@angular/common';
import { Component, ElementRef, ViewEncapsulation, effect, inject, input, viewChild } from '@angular/core';
import { AnimatableDirective, ProvideColorDirective, createCanAnimateSignal } from '@ethlete/core';
import { FormErrorComponent } from '../form-field/form-error.component';
import { FormFieldDirective, injectFormSupport, provideFormSupport } from '../form-field/headless';
import { RangeSliderDirective, SliderThumbDirective, SliderThumbLabelContext, SliderTrackDirective } from './headless';

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
      ],
      outputs: ['valueChange', 'touchedChange'],
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
  },
})
export class RangeSliderComponent {
  public support = injectFormSupport();
  protected slider = inject(RangeSliderDirective);

  /** Accessible name of the start thumb. */
  public startLabel = input('Minimum');

  /** Accessible name of the end thumb. */
  public endLabel = input('Maximum');

  private errorContentRef = viewChild<ElementRef<HTMLElement>>('errorContent');
  private hintContentRef = viewChild<ElementRef<HTMLElement>>('hintContent');
  private errorAnimatableRef = viewChild<AnimatableDirective>('errorAnimatable');
  private hintAnimatableRef = viewChild<AnimatableDirective>('hintAnimatable');
  public canAnimate = createCanAnimateSignal();

  constructor() {
    effect(() => {
      this.support.errorContent.set(this.errorContentRef());
      this.support.hintContent.set(this.hintContentRef());
      this.support.errorAnimatable.set(this.errorAnimatableRef());
      this.support.hintAnimatable.set(this.hintAnimatableRef());
    });
  }

  protected thumbLabelContext(index: number): SliderThumbLabelContext {
    return { $implicit: this.slider.thumbValues()[index] ?? 0, index };
  }
}
