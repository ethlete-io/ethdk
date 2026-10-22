import { Component, signal, ViewEncapsulation } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import {
  CHECK_ICON,
  FORM_FIELD_IMPORTS,
  ICON_IMPORTS,
  INPUT_IMPORTS,
  LOCK_ICON,
  provideIcons,
} from '@ethlete/components';

@Component({
  selector: 'app-icon-affixes-example',
  template: `
    <et-form-field appearance="box">
      <et-label>API key</et-label>
      <i etIcon="et-lock" etInputPrefix></i>
      <et-input [formField]="keyForm.apiKey" placeholder="sk-…" />
      <i etIcon="et-check" etInputSuffix></i>
    </et-form-field>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, INPUT_IMPORTS, ICON_IMPORTS, FormField],
  providers: [provideIcons(CHECK_ICON, LOCK_ICON)],
})
export class IconAffixesExampleComponent {
  private model = signal({ apiKey: '' });

  protected keyForm = form(this.model);
}
