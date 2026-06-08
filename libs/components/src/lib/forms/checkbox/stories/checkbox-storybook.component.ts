import { ChangeDetectionStrategy, Component, input, linkedSignal, ViewEncapsulation } from '@angular/core';
import { disabled, form, FormField, required } from '@angular/forms/signals';
import { ProvideColorDirective } from '@ethlete/core';
import { CHOICE_FIELD_IMPORTS } from '../../choice-field';
import { CHECKBOX_IMPORTS } from '../checkbox.imports';

@Component({
  selector: 'et-sb-form-field-checkbox',
  template: `
    <div [etProvideColor]="color()" class="flex max-w-md flex-col gap-4 p-8 font-sans">
      <et-choice-field>
        <et-checkbox [formField]="demoForm.acceptTerms" />
        <et-label>I accept the terms and conditions</et-label>
        @if (hint()) {
          <et-hint>{{ hint() }}</et-hint>
        }
      </et-choice-field>

      <et-choice-field>
        <et-checkbox [formField]="demoForm.acceptTermsChecked" />
        <et-label>I accept the terms and conditions</et-label>
        @if (hint()) {
          <et-hint>{{ hint() }}</et-hint>
        }
      </et-choice-field>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...CHOICE_FIELD_IMPORTS, ...CHECKBOX_IMPORTS, FormField, ProvideColorDirective],
})
export class FormFieldCheckboxStorybookComponent {
  public color = input('brand');
  public hint = input('');
  public disabled = input(false);
  public required = input(false);

  private formModel = linkedSignal(() => ({
    acceptTerms: false,
    acceptTermsChecked: true,
  }));

  public demoForm = form(this.formModel, (s) => {
    disabled(s, () => this.disabled());
    required(s.acceptTerms, { when: () => this.required(), message: 'You must accept the terms' });
    required(s.acceptTermsChecked, { when: () => this.required(), message: 'You must accept the terms' });
  });
}
