import { NgTemplateOutlet } from '@angular/common';
import { Component, ElementRef, ViewEncapsulation, inject, viewChild } from '@angular/core';
import { AnimatableDirective, ProvideColorDirective, createCanAnimateSignal } from '@ethlete/core';
import { FormErrorComponent } from '../form-field/form-error.component';
import { FormFieldDirective, injectFormSupport, wireFormSupport, provideFormSupport } from '../form-field/headless';
import { SliderDirective, SliderThumbDirective, SliderThumbLabelContext, SliderTrackDirective } from './headless';

@Component({
  selector: 'et-slider',
  templateUrl: './slider.component.html',
  styleUrl: './slider.component.css',
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
      directive: SliderDirective,
      inputs: [
        'value',
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
      ],
      outputs: ['valueChange', 'touchedChange'],
    },
    { directive: ProvideColorDirective, inputs: ['etProvideColor:color'] },
  ],
  host: {
    class: 'et-slider',
    '[attr.data-can-animate]': 'canAnimate.state() || null',
    '[attr.data-error]': 'support.displaysError() || null',
    '[attr.data-disabled]': 'slider.disabled() || null',
    '[attr.data-readonly]': 'slider.readonly() || null',
    '[attr.data-dragging]': 'slider.draggingThumbIndex() !== null || null',
  },
})
export class SliderComponent {
  public support = injectFormSupport();
  protected slider = inject(SliderDirective);

  private errorContentRef = viewChild<ElementRef<HTMLElement>>('errorContent');
  private hintContentRef = viewChild<ElementRef<HTMLElement>>('hintContent');
  private errorAnimatableRef = viewChild<AnimatableDirective>('errorAnimatable');
  private hintAnimatableRef = viewChild<AnimatableDirective>('hintAnimatable');
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
