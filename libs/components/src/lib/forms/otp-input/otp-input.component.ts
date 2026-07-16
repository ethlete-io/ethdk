import {
  Component,
  ElementRef,
  ViewEncapsulation,
  afterNextRender,
  computed,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import { AnimatableDirective, ProvideColorDirective, createCanAnimateSignal } from '@ethlete/core';
import { FormErrorComponent } from '../form-field/form-error.component';
import { FormFieldDirective, injectFormSupport, provideFormSupport } from '../form-field/headless';
import { OtpInputDirective } from './headless';

@Component({
  selector: 'et-otp-input',
  templateUrl: './otp-input.component.html',
  styleUrl: './otp-input.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [AnimatableDirective, FormErrorComponent, ProvideColorDirective],
  providers: [provideFormSupport()],
  hostDirectives: [
    FormFieldDirective,
    {
      directive: OtpInputDirective,
      inputs: [
        'value',
        'touched',
        'disabled',
        'readonly',
        'invalid',
        'errors',
        'required',
        'name',
        'length',
        'charset',
        'masked',
      ],
      outputs: ['valueChange', 'touchedChange', 'completed'],
    },
    { directive: ProvideColorDirective, inputs: ['etProvideColor:color'] },
  ],
  host: {
    class: 'et-otp-input',
    '[attr.data-can-animate]': 'canAnimate.state() || null',
    '[attr.data-error]': 'support.displaysError() || null',
    '(click)': 'otp.activate()',
  },
})
export class OtpInputComponent {
  public support = injectFormSupport();
  protected otp = inject(OtpInputDirective);

  public nativeInput = viewChild<ElementRef<HTMLInputElement>>('nativeInput');

  private errorContentRef = viewChild<ElementRef<HTMLElement>>('errorContent');
  private hintContentRef = viewChild<ElementRef<HTMLElement>>('hintContent');
  private errorAnimatableRef = viewChild<AnimatableDirective>('errorAnimatable');
  private hintAnimatableRef = viewChild<AnimatableDirective>('hintAnimatable');
  public canAnimate = createCanAnimateSignal();

  protected segmentIndexes = computed(() => Array.from({ length: this.otp.length() }, (_, index) => index));

  constructor() {
    afterNextRender(() => {
      this.otp.nativeControl.set(this.nativeInput()?.nativeElement ?? null);
    });

    effect(() => {
      this.support.errorContent.set(this.errorContentRef());
      this.support.hintContent.set(this.hintContentRef());
      this.support.errorAnimatable.set(this.errorAnimatableRef());
      this.support.hintAnimatable.set(this.hintAnimatableRef());
    });
  }
}
