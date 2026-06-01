import { ChangeDetectionStrategy, Component, effect, ElementRef, viewChild, ViewEncapsulation } from '@angular/core';
import { AnimatableDirective, createCanAnimateSignal, ProvideColorDirective } from '@ethlete/core';
import { FormErrorComponent } from '../../form-field/form-error.component';
import { FormFieldDirective, injectFormSupport, provideFormSupport } from '../../form-field/headless';
import { SELECTION_LIST_MULTIPLE, SelectionListDirective } from '../headless';

@Component({
  selector: 'et-checkbox-group',
  templateUrl: './checkbox-group.component.html',
  styleUrl: './checkbox-group.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AnimatableDirective, FormErrorComponent, ProvideColorDirective],
  providers: [{ provide: SELECTION_LIST_MULTIPLE, useValue: true }, provideFormSupport()],
  hostDirectives: [
    FormFieldDirective,
    {
      directive: SelectionListDirective,
      inputs: ['value', 'touched', 'disabled', 'invalid', 'errors', 'required', 'name'],
      outputs: ['valueChange', 'touchedChange'],
    },
    { directive: ProvideColorDirective, inputs: ['etProvideColor:color'] },
  ],
  host: {
    class: 'et-checkbox-group',
    '[attr.data-can-animate]': 'canAnimate.state() || null',
    '[attr.data-error]': 'support.displaysError() || null',
  },
})
export class CheckboxGroupComponent {
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
