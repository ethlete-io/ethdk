import { ChangeDetectionStrategy, Component, effect, ElementRef, viewChild, ViewEncapsulation } from '@angular/core';
import {
  AnimatableDirective,
  ColorInteractiveContainerDirective,
  ColorInteractiveExcludeDirective,
  createCanAnimateSignal,
  ProvideColorDirective,
} from '@ethlete/core';
import { FormErrorComponent } from '../form-field/form-error.component';
import { FormFieldDirective, injectFormSupport, provideFormSupport } from '../form-field/headless';

@Component({
  selector: 'et-choice-field',
  templateUrl: './choice-field.component.html',
  styleUrl: './choice-field.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
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
    '[attr.data-can-animate]': 'canAnimate.state() || null',
    '[attr.data-error]': 'support.displaysError() || null',
  },
})
export class ChoiceFieldComponent {
  private errorContentRef = viewChild<ElementRef<HTMLElement>>('errorContent');
  private hintContentRef = viewChild<ElementRef<HTMLElement>>('hintContent');
  private errorAnimatableRef = viewChild<AnimatableDirective>('errorAnimatable');
  private hintAnimatableRef = viewChild<AnimatableDirective>('hintAnimatable');

  public support = injectFormSupport();
  public canAnimate = createCanAnimateSignal();

  constructor() {
    effect(() => {
      this.support.errorContent.set(this.errorContentRef());
      this.support.hintContent.set(this.hintContentRef());
      this.support.errorAnimatable.set(this.errorAnimatableRef());
      this.support.hintAnimatable.set(this.hintAnimatableRef());
    });
  }
}
