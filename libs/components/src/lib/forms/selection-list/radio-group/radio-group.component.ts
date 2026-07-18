import { Component, ElementRef, input, viewChild, ViewEncapsulation } from '@angular/core';
import { AnimatableDirective, createCanAnimateSignal, ProvideColorDirective } from '@ethlete/core';
import { FormErrorComponent } from '../../form-field/form-error.component';
import { FORM_FIELD_SIZES, FormFieldSize } from '../../form-field/form-field.variants';
import { FormFieldDirective, injectFormSupport, wireFormSupport, provideFormSupport } from '../../form-field/headless';
import { SelectionListDirective } from '../../selection-list/headless';

@Component({
  selector: 'et-radio-group',
  templateUrl: './radio-group.component.html',
  styleUrl: './radio-group.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [AnimatableDirective, FormErrorComponent, ProvideColorDirective],
  providers: [provideFormSupport()],
  hostDirectives: [
    FormFieldDirective,
    {
      directive: SelectionListDirective,
      inputs: ['value', 'touched', 'disabled', 'readonly', 'invalid', 'errors', 'required', 'name'],
      outputs: ['valueChange', 'touchedChange'],
    },
    { directive: ProvideColorDirective, inputs: ['etProvideColor:color'] },
  ],
  host: {
    class: 'et-radio-group',
    '[attr.data-size]': 'size()',
    '[attr.data-can-animate]': 'canAnimate.state() || null',
    '[attr.data-error]': 'support.displaysError() || null',
  },
})
export class RadioGroupComponent {
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
