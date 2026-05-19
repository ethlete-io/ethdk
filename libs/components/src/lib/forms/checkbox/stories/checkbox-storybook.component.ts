import { ChangeDetectionStrategy, Component, computed, inject, signal, ViewEncapsulation } from '@angular/core';
import { form, FormField, required } from '@angular/forms/signals';
import { CheckboxGroupDirective } from '../../checkbox-group';
import { CHOICE_FIELD_IMPORTS } from '../../choice-field';
import { CHECKBOX_IMPORTS } from '../checkbox.imports';

@Component({
  selector: 'et-sb-form-field-checkbox',
  template: `
    <div class="flex max-w-md flex-col gap-4 p-8 font-sans">
      <et-choice-field>
        <et-checkbox [formField]="demoForm.acceptTerms" />
        <et-label>I accept the terms and conditions</et-label>
      </et-choice-field>

      <et-choice-field>
        <et-checkbox [formField]="demoForm.newsletter" />
        <et-label>Subscribe to newsletter</et-label>
      </et-choice-field>

      <p class="text-xs text-et-surface-muted">"Accept terms" is required. Click away from it to trigger validation.</p>

      <pre class="rounded bg-et-surface-bg p-2 text-xs">{{ debugInfo() }}</pre>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...CHOICE_FIELD_IMPORTS, ...CHECKBOX_IMPORTS, FormField],
})
export class FormFieldCheckboxStorybookComponent {
  private formModel = signal({
    acceptTerms: false,
    newsletter: false,
  });

  public demoForm = form(this.formModel, (s) => {
    required(s.acceptTerms, { message: 'You must accept the terms' });
  });

  public debugInfo = computed(() => JSON.stringify(this.formModel(), null, 2));
}

@Component({
  selector: 'et-sb-checkbox-group',
  template: `
    <div class="flex max-w-md flex-col gap-4 p-8 font-sans">
      <et-choice-field>
        <et-checkbox
          [skipGroup]="true"
          [checked]="groupDir.allChecked()"
          [indeterminate]="groupDir.someChecked()"
          (checkedChange)="groupDir.toggleAll()"
        />
        <et-label>Select all</et-label>
      </et-choice-field>

      <div class="flex flex-col gap-2 pl-7">
        <et-choice-field>
          <et-checkbox [formField]="demoForm.optionA" />
          <et-label>Option A</et-label>
        </et-choice-field>

        <et-choice-field>
          <et-checkbox [formField]="demoForm.optionB" />
          <et-label>Option B</et-label>
        </et-choice-field>

        <et-choice-field>
          <et-checkbox [formField]="demoForm.optionC" />
          <et-label>Option C</et-label>
        </et-choice-field>
      </div>

      <pre class="rounded bg-et-surface-bg p-2 text-xs">{{ debugInfo() }}</pre>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...CHOICE_FIELD_IMPORTS, ...CHECKBOX_IMPORTS, FormField],
  hostDirectives: [CheckboxGroupDirective],
})
export class CheckboxGroupStorybookComponent {
  protected groupDir = inject(CheckboxGroupDirective);

  private formModel = signal({
    optionA: false,
    optionB: true,
    optionC: false,
  });

  public demoForm = form(this.formModel);

  public debugInfo = computed(() => JSON.stringify(this.formModel(), null, 2));
}
