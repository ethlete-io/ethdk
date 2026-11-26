import { Component, signal, ViewEncapsulation } from '@angular/core';
import { form, FormField, maxLength } from '@angular/forms/signals';
import { FORM_FIELD_IMPORTS, TEXTAREA_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-form-field-counter-example',
  template: `
    <et-form-field>
      <et-label>Bio</et-label>
      <et-textarea [formField]="bioForm.bio" placeholder="Tell us about yourself…" />
      <et-hint>A short introduction shown on your profile.</et-hint>
      <et-counter />
    </et-form-field>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, TEXTAREA_IMPORTS, FormField],
})
export class FormFieldCounterExampleComponent {
  private model = signal({ bio: '' });

  protected bioForm = form(this.model, (s) => {
    maxLength(s.bio, 180, { message: 'Keep the bio under 180 characters' });
  });
}
