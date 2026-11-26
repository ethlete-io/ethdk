import { Component, signal, ViewEncapsulation } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { CHECKBOX_IMPORTS, CHOICE_FIELD_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-checkbox-indeterminate-example',
  template: `
    <et-choice-field>
      <et-checkbox [(indeterminate)]="indeterminate" [formField]="termsForm.acceptTerms" />
      <et-label>I accept the terms and conditions</et-label>
      <et-hint>Tri-state: toggling an indeterminate checkbox resolves it to checked</et-hint>
    </et-choice-field>

    <et-choice-field>
      <et-checkbox [formField]="termsForm.updates" />
      <et-label>Send me product updates</et-label>
    </et-choice-field>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [CHOICE_FIELD_IMPORTS, CHECKBOX_IMPORTS, FormField],
})
export class CheckboxIndeterminateExampleComponent {
  protected indeterminate = signal(true);

  private model = signal({ acceptTerms: false, updates: true });

  protected termsForm = form(this.model);
}
