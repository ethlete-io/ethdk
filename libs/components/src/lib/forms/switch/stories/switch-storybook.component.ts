import { ChangeDetectionStrategy, Component, computed, signal, ViewEncapsulation } from '@angular/core';
import { form, FormField, required } from '@angular/forms/signals';
import { CHOICE_FIELD_IMPORTS } from '../../choice-field';
import { SWITCH_IMPORTS } from '../switch.imports';

@Component({
  selector: 'et-sb-form-field-switch',
  template: `
    <div class="flex max-w-md flex-col gap-4 p-8 font-sans">
      <et-choice-field>
        <et-switch [formField]="demoForm.notifications" />
        <et-label>Enable notifications</et-label>
      </et-choice-field>

      <et-choice-field>
        <et-switch [formField]="demoForm.darkMode" />
        <et-label>Dark mode</et-label>
      </et-choice-field>

      <et-choice-field>
        <et-switch [formField]="demoForm.acceptTerms" />
        <et-label>Accept terms</et-label>
      </et-choice-field>

      <p class="text-xs text-et-surface-muted">"Accept terms" is required. Click away from it to trigger validation.</p>

      <pre class="rounded bg-et-surface-bg p-2 text-xs">{{ debugInfo() }}</pre>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...CHOICE_FIELD_IMPORTS, ...SWITCH_IMPORTS, FormField],
})
export class FormFieldSwitchStorybookComponent {
  private formModel = signal({
    notifications: true,
    darkMode: false,
    acceptTerms: false,
  });

  public demoForm = form(this.formModel, (s) => {
    required(s.acceptTerms, { message: 'You must accept the terms' });
  });

  public debugInfo = computed(() => JSON.stringify(this.formModel(), null, 2));
}

@Component({
  selector: 'et-sb-switch-disabled',
  template: `
    <div class="flex max-w-md flex-col gap-4 p-8 font-sans">
      <et-choice-field>
        <et-switch [checked]="true" [disabled]="true" />
        <et-label>Enabled (disabled control)</et-label>
      </et-choice-field>

      <et-choice-field>
        <et-switch [disabled]="true" />
        <et-label>Disabled (disabled control)</et-label>
      </et-choice-field>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...CHOICE_FIELD_IMPORTS, ...SWITCH_IMPORTS],
})
export class SwitchDisabledStorybookComponent {}
