import { Component, ElementRef, ViewEncapsulation, afterNextRender, computed, inject, viewChild } from '@angular/core';
import { AnimatableDirective, ProvideColorDirective, createCanAnimateSignal } from '@ethlete/core';
import { FormErrorComponent } from '../form-field/form-error.component';
import { FormWarningComponent } from '../form-field/form-warning.component';
import { FormFieldDirective, injectFormSupport, wireFormSupport, provideFormSupport } from '../form-field/headless';
import { OtpInputDirective } from './headless';
import { ACCESSIBLE_NAME_INPUTS } from '../form-field/headless';

@Component({
  selector: 'et-otp-input',
  templateUrl: './otp-input.component.html',
  styleUrl: './otp-input.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [AnimatableDirective, FormErrorComponent, FormWarningComponent, ProvideColorDirective],
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
        ...ACCESSIBLE_NAME_INPUTS,
      ],
      outputs: ['valueChange', 'touchedChange', 'complete'],
    },
    { directive: ProvideColorDirective, inputs: ['etProvideColor:color'] },
  ],
  host: {
    class: 'et-otp-input',
    '[attr.data-can-animate]': 'canAnimate.state() || null',
    '[attr.data-error]': 'support.displaysError() || null',
    '[attr.data-warning]': 'support.displaysWarning() || null',
    '(click)': 'otp.activate()',
  },
})
export class OtpInputComponent {
  public support = injectFormSupport();
  protected otp = inject(OtpInputDirective);

  public nativeInput = viewChild<ElementRef<HTMLInputElement>>('nativeInput');

  private errorContentRef = viewChild<ElementRef<HTMLElement>>('errorContent');
  private warningContentRef = viewChild<ElementRef<HTMLElement>>('warningContent');
  private hintContentRef = viewChild<ElementRef<HTMLElement>>('hintContent');
  private errorAnimatableRef = viewChild<AnimatableDirective>('errorAnimatable');
  private warningAnimatableRef = viewChild<AnimatableDirective>('warningAnimatable');
  private hintAnimatableRef = viewChild<AnimatableDirective>('hintAnimatable');
  public canAnimate = createCanAnimateSignal();

  protected segmentIndexes = computed(() => Array.from({ length: this.otp.length() }, (_, index) => index));

  constructor() {
    afterNextRender(() => {
      this.otp.nativeControl.set(this.nativeInput()?.nativeElement ?? null);
    });

    wireFormSupport(this.support, {
      errorContent: this.errorContentRef,
      warningContent: this.warningContentRef,
      hintContent: this.hintContentRef,
      errorAnimatable: this.errorAnimatableRef,
      warningAnimatable: this.warningAnimatableRef,
      hintAnimatable: this.hintAnimatableRef,
    });
  }

  public focus(options?: FocusOptions) {
    this.otp.focus(options);
  }
}
