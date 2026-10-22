import { Component, signal, ViewEncapsulation } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { FORM_FIELD_IMPORTS, OTP_INPUT_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-otp-input-default-example',
  template: `
    <et-otp-input [formField]="demoForm.code" [length]="6" (complete)="lastCompleted.set($event)">
      <et-label>Verification code</et-label>
    </et-otp-input>

    <p>Form value: "{{ demoForm.code().value() }}"</p>
    @if (lastCompleted()) {
      <p>Completed: {{ lastCompleted() }}</p>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, OTP_INPUT_IMPORTS, FormField],
})
export class OtpInputDefaultExampleComponent {
  protected lastCompleted = signal('');

  private model = signal({ code: '' });

  protected demoForm = form(this.model);
}
