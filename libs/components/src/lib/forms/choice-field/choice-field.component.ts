import { Component, ElementRef, input, viewChild, ViewEncapsulation } from '@angular/core';
import {
  AnimatableDirective,
  ColorInteractiveContainerDirective,
  ColorInteractiveExcludeDirective,
  createCanAnimateSignal,
  ProvideColorDirective,
} from '@ethlete/core';
import { FormErrorComponent } from '../form-field/form-error.component';
import { FORM_FIELD_SIZES, FormFieldSize } from '../form-field/form-field.variants';
import { FormFieldDirective, injectFormSupport, wireFormSupport, provideFormSupport } from '../form-field/headless';

@Component({
  selector: 'et-choice-field',
  templateUrl: './choice-field.component.html',
  styleUrl: './choice-field.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [
    AnimatableDirective,
    ColorInteractiveContainerDirective,
    ColorInteractiveExcludeDirective,
    FormErrorComponent,
    ProvideColorDirective,
  ],
  providers: [provideFormSupport()],
  hostDirectives: [FormFieldDirective, { directive: ProvideColorDirective, inputs: ['etProvideColor:color'] }],
  host: {
    class: 'et-choice-field',
    '[attr.data-size]': 'size()',
    '[attr.data-can-animate]': 'canAnimate.state() || null',
    '[attr.data-error]': 'support.displaysError() || null',
  },
})
export class ChoiceFieldComponent {
  public support = injectFormSupport();
  public size = input<FormFieldSize>(FORM_FIELD_SIZES.MD);
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
}
