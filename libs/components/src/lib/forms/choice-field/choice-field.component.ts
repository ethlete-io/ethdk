import { Component, ElementRef, input, viewChild, ViewEncapsulation } from '@angular/core';
import {
  AnimatableDirective,
  ColorInteractiveContainerDirective,
  ColorInteractiveDirective,
  ColorInteractiveExcludeDirective,
  createCanAnimateSignal,
  ProvideColorDirective,
} from '@ethlete/core';
import { FormErrorComponent } from '../form-field/form-error.component';
import { FORM_FIELD_SIZES, FormFieldSize } from '../form-field/form-field.variants';
import { FormFieldDirective, injectFormSupport, wireFormSupport, provideFormSupport } from '../form-field/headless';

/** How a choice field presents itself. See {@link ChoiceFieldComponent.variant}. */
export const CHOICE_FIELD_VARIANTS = {
  PLAIN: 'plain',
  CARD: 'card',
} as const;

export type ChoiceFieldVariant = (typeof CHOICE_FIELD_VARIANTS)[keyof typeof CHOICE_FIELD_VARIANTS];

@Component({
  selector: 'et-choice-field',
  templateUrl: './choice-field.component.html',
  styleUrl: './choice-field.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [
    AnimatableDirective,
    ColorInteractiveContainerDirective,
    ColorInteractiveDirective,
    ColorInteractiveExcludeDirective,
    FormErrorComponent,
    ProvideColorDirective,
  ],
  providers: [provideFormSupport()],
  hostDirectives: [FormFieldDirective, { directive: ProvideColorDirective, inputs: ['etProvideColor:color'] }],
  host: {
    class: 'et-choice-field',
    '[attr.data-size]': 'size()',
    '[attr.data-variant]': 'variant()',
    '[attr.data-can-animate]': 'canAnimate.state() || null',
    '[attr.data-error]': 'support.displaysError() || null',
  },
})
export class ChoiceFieldComponent {
  public support = injectFormSupport();
  public size = input<FormFieldSize>(FORM_FIELD_SIZES.MD);

  /**
   * `'card'` turns the row into a full-width clickable panel with the label leading and the control trailing - for
   * a short list of consequential options where each wants room for a hint. Works for whichever control is
   * projected, so a checkbox and a switch get the same preset. @default 'plain'
   */
  public variant = input<ChoiceFieldVariant>(CHOICE_FIELD_VARIANTS.PLAIN);
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
