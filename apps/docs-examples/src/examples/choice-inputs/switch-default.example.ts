import { Component, signal, ViewEncapsulation } from '@angular/core';
import { form, FormField, required } from '@angular/forms/signals';
import { CHOICE_FIELD_IMPORTS, SWITCH_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-switch-default-example',
  template: `
    <et-choice-field>
      <et-switch [formField]="settingsForm.notifications" />
      <et-label>Enable notifications</et-label>
    </et-choice-field>

    <et-choice-field>
      <et-switch [formField]="settingsForm.darkMode" />
      <et-label>Dark mode</et-label>
    </et-choice-field>

    <et-choice-field>
      <et-switch [formField]="settingsForm.acceptTerms" />
      <et-label>Accept terms</et-label>
    </et-choice-field>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [CHOICE_FIELD_IMPORTS, SWITCH_IMPORTS, FormField],
})
export class SwitchDefaultExampleComponent {
  private model = signal({ notifications: true, darkMode: false, acceptTerms: false });

  protected settingsForm = form(this.model, (s) => {
    required(s.acceptTerms, { message: 'You must accept the terms' });
  });
}
