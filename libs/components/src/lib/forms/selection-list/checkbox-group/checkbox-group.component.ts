import { Component, ElementRef, input, viewChild, ViewEncapsulation } from '@angular/core';
import { AnimatableDirective, createCanAnimateSignal, ProvideColorDirective } from '@ethlete/core';
import { FormErrorComponent } from '../../form-field/form-error.component';
import { FORM_FIELD_SIZES, FormFieldSize } from '../../form-field/form-field.variants';
import { FormFieldDirective, injectFormSupport, wireFormSupport, provideFormSupport } from '../../form-field/headless';
import { SELECTION_LIST_MULTIPLE, SelectionListDirective } from '../headless';

@Component({
  selector: 'et-checkbox-group',
  templateUrl: './checkbox-group.component.html',
  styleUrl: './checkbox-group.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [AnimatableDirective, FormErrorComponent, ProvideColorDirective],
  providers: [{ provide: SELECTION_LIST_MULTIPLE, useValue: true }, provideFormSupport()],
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
    class: 'et-checkbox-group',
    '[attr.data-size]': 'size()',
    '[attr.data-can-animate]': 'canAnimate.state() || null',
    '[attr.data-error]': 'support.displaysError() || null',
  },
})
export class CheckboxGroupComponent {
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
