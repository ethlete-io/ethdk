import { Component, ViewEncapsulation, input, linkedSignal, signal } from '@angular/core';
import { FormField, disabled, form, readonly, required } from '@angular/forms/signals';
import { ProvideColorDirective } from '@ethlete/core';
import { LabelDirective } from '../../form-field';
import { HintComponent } from '../../form-field/hint.component';
import { OTP_INPUT_IMPORTS } from '../otp-input.imports';

@Component({
  selector: 'et-sb-otp-input',
  template: `
    <div [etProvideColor]="color()" class="flex max-w-md flex-col gap-4 p-8 font-sans">
      <et-otp-input
        [formField]="demoForm.value"
        [length]="length()"
        [charset]="charset()"
        [masked]="masked()"
        (complete)="lastCompleted.set($event)"
      >
        <et-label>{{ label() }}</et-label>
        @if (hint()) {
          <et-hint>{{ hint() }}</et-hint>
        }
      </et-otp-input>

      <p class="text-sm opacity-60">Form value: "{{ demoForm.value().value() }}"</p>
      @if (lastCompleted()) {
        <p class="text-sm opacity-60">Completed: {{ lastCompleted() }}</p>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [...OTP_INPUT_IMPORTS, LabelDirective, HintComponent, FormField, ProvideColorDirective],
})
export class OtpInputStorybookComponent {
  public label = input('Verification code');
  public hint = input('');
  public length = input(6);
  public charset = input<'numeric' | 'alphanumeric'>('numeric');
  public masked = input(false);
  public disabled = input(false);
  public readonly = input(false);
  public required = input(false);
  public color = input('brand');

  protected lastCompleted = signal('');

  private formModel = linkedSignal(() => ({ value: '' }));

  public demoForm = form(this.formModel, (s) => {
    disabled(s, () => this.disabled());
    readonly(s.value, () => this.readonly());
    required(s.value, { when: () => this.required(), message: 'The code is required' });
  });
}
