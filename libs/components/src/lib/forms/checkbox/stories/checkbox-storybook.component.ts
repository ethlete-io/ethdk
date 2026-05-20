import { ChangeDetectionStrategy, Component, inject, input, signal, ViewEncapsulation } from '@angular/core';
import { disabled, form, FormField, required } from '@angular/forms/signals';
import { ProvideColorDirective } from '@ethlete/core';
import { CheckboxGroupDirective } from '../../checkbox-group';
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

  private formModel = signal({
    acceptTerms: false,
  });

  public demoForm = form(this.formModel, (s) => {
    disabled(s, () => this.disabled());
    required(s.acceptTerms, { when: () => this.required(), message: 'You must accept the terms' });
  });
}

@Component({
  selector: 'et-sb-checkbox-group',
  template: `
    <div [etProvideColor]="color()" class="flex max-w-md flex-col gap-4 p-8 font-sans">
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
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...CHOICE_FIELD_IMPORTS, ...CHECKBOX_IMPORTS, FormField, ProvideColorDirective],
  hostDirectives: [CheckboxGroupDirective],
})
export class CheckboxGroupStorybookComponent {
  protected groupDir = inject(CheckboxGroupDirective);

  public color = input('brand');
  public disabled = input(false);

  private formModel = signal({
    optionA: false,
    optionB: true,
    optionC: false,
  });

  public demoForm = form(this.formModel, (s) => {
    disabled(s, () => this.disabled());
  });
}
