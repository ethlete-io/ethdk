import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { disabled, form, FormField, required } from '@angular/forms/signals';
import { ProvideColorDirective } from '@ethlete/core';
import { CHECKBOX_IMPORTS } from '../../checkbox';
import { CheckboxGroupDirective } from '../../checkbox-group';
import { CHOICE_FIELD_IMPORTS } from '../../choice-field';
import {
  FORM_FIELD_APPEARANCES,
  FORM_FIELD_FILLS,
  FORM_FIELD_IMPORTS,
  FORM_FIELD_LABEL_MODES,
  FORM_FIELD_SIZES,
  FormFieldAppearance,
  FormFieldFill,
  FormFieldLabelMode,
  FormFieldSize,
} from '../../form-field';
import { InputPrefixDirective, InputSuffixDirective } from '../../form-field/partials';
import { INPUT_IMPORTS, INPUT_TYPES } from '../../input';

@Component({
  selector: 'et-sb-form-field-input',
  template: `
    <div [etProvideColor]="color()" class="flex max-w-md flex-col gap-4 p-8 font-sans">
      <et-form-field [appearance]="appearance()" [fill]="fill()" [size]="size()" [labelMode]="labelMode()">
        <et-label>{{ label() }}</et-label>
        @if (showPrefix()) {
          <span etInputPrefix>@</span>
        }
        <et-input [formField]="demoForm.value" [type]="type()" [placeholder]="placeholder()" />
        @if (showSuffix()) {
          <span etInputSuffix>.com</span>
        }
        @if (hint()) {
          <et-hint>{{ hint() }}</et-hint>
        }
      </et-form-field>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ...FORM_FIELD_IMPORTS,
    ...INPUT_IMPORTS,
    InputPrefixDirective,
    InputSuffixDirective,
    FormField,
    ProvideColorDirective,
  ],
})
export class FormFieldInputStorybookComponent {
  public appearance = input<FormFieldAppearance>(FORM_FIELD_APPEARANCES.BOX);
  public fill = input<FormFieldFill>(FORM_FIELD_FILLS.TRANSPARENT);
  public size = input<FormFieldSize>(FORM_FIELD_SIZES.MD);
  public labelMode = input<FormFieldLabelMode>(FORM_FIELD_LABEL_MODES.STATIC);
  public type = input<(typeof INPUT_TYPES)[keyof typeof INPUT_TYPES]>(INPUT_TYPES.TEXT);
  public label = input('Label');
  public placeholder = input('Placeholder');
  public hint = input('');
  public value = input('');
  public disabled = input(false);
  public required = input(false);
  public showPrefix = input(false);
  public showSuffix = input(false);
  public color = input('brand');

  private formModel = linkedSignal(() => ({ value: this.value() }));

  public demoForm = form(this.formModel, (s) => {
    disabled(s, () => this.disabled());
    required(s.value, { when: () => this.required(), message: 'This field is required' });
  });
}

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
