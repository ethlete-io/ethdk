import { ChangeDetectionStrategy, Component, input, linkedSignal, ViewEncapsulation } from '@angular/core';
import { disabled, form, FormField, required } from '@angular/forms/signals';
import { ProvideColorDirective } from '@ethlete/core';
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
import { INPUT_TYPES } from '../headless/input.directive';
import { INPUT_IMPORTS } from '../input.imports';

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
