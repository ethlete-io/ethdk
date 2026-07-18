import { Component, ViewEncapsulation, input, linkedSignal } from '@angular/core';
import { FormField, disabled, form, required } from '@angular/forms/signals';
import { ProvideColorDirective } from '@ethlete/core';
import { FORM_FIELD_IMPORTS } from '../../form-field';
import { PASSWORD_INPUT_IMPORTS } from '../input.imports';

@Component({
  selector: 'et-sb-password-input',
  template: `
    <div [etProvideColor]="color()" class="flex max-w-md flex-col gap-4 p-8 font-sans">
      <et-form-field>
        <et-label>{{ label() }}</et-label>
        <et-password-input
          #pw="etPasswordInput"
          [formField]="demoForm.value"
          [revealable]="revealable()"
          [capsLockWarning]="capsLockWarning()"
          [placeholder]="placeholder()"
          autocomplete="new-password"
        />
        @if (hint()) {
          <et-hint>{{ hint() }}</et-hint>
        }
      </et-form-field>

      @if (showStrength()) {
        <div class="flex items-center gap-2" aria-hidden="true">
          @for (segment of [1, 2, 3, 4]; track segment) {
            <div
              [style.background]="
                pw.strength() >= segment ? 'var(--et-theme-color-primary-solid)' : 'rgb(128 128 128 / 0.3)'
              "
              class="h-1 flex-1 rounded-full"
            ></div>
          }
        </div>
        <p class="text-sm opacity-60">Strength score: {{ pw.strength() }}/4</p>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [...FORM_FIELD_IMPORTS, ...PASSWORD_INPUT_IMPORTS, FormField, ProvideColorDirective],
})
export class PasswordInputStorybookComponent {
  public label = input('Password');
  public hint = input('');
  public placeholder = input('');
  public value = input('');
  public revealable = input(true);
  public capsLockWarning = input(false);
  public showStrength = input(false);
  public disabled = input(false);
  public required = input(false);
  public color = input('brand');

  private formModel = linkedSignal(() => ({ value: this.value() }));

  public demoForm = form(this.formModel, (s) => {
    disabled(s, () => this.disabled());
    required(s.value, { when: () => this.required(), message: 'A password is required' });
  });
}
