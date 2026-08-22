import { Component, ElementRef, ViewEncapsulation, afterNextRender, computed, inject, viewChild } from '@angular/core';
import { ProvideColorDirective, createCanAnimateSignal } from '@ethlete/core';
import { FormSupportComponent } from '../form-field/partials/form-support.component';
import { FormFieldDirective, injectFormSupport, provideFormSupport } from '../form-field/headless';
import { OtpInputDirective } from './headless';
import { ACCESSIBLE_NAME_INPUTS } from '../form-field/headless';

@Component({
  selector: 'et-otp-input',
  templateUrl: './otp-input.component.html',
  styleUrl: './otp-input.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [FormSupportComponent],
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

  public canAnimate = createCanAnimateSignal();

  protected segmentIndexes = computed(() => Array.from({ length: this.otp.length() }, (_, index) => index));

  constructor() {
    afterNextRender(() => {
      this.otp.nativeControl.set(this.nativeInput()?.nativeElement ?? null);
    });
  }

  public focus(options?: FocusOptions) {
    this.otp.focus(options);
  }
}
