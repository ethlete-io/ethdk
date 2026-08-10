import { Component, input, linkedSignal, ViewEncapsulation } from '@angular/core';
import { disabled, form, FormField, readonly, required } from '@angular/forms/signals';
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
import { NUMBER_INPUT_IMPORTS } from '../input.imports';

@Component({
  selector: 'et-sb-form-field-number-input',
  template: `
    <div [etProvideColor]="color()" class="flex max-w-md flex-col gap-4 p-8 font-sans">
      <et-form-field [appearance]="appearance()" [fill]="fill()" [size]="size()" [labelMode]="labelMode()">
        <et-label>{{ label() }}</et-label>
        @if (showPrefix()) {
          <span etInputPrefix>€</span>
        }
        <et-number-input
          [(mixed)]="mixedState"
          [formField]="demoForm.value"
          [mixedLabel]="mixedLabel()"
          [min]="min() ?? undefined"
          [max]="max() ?? undefined"
          [step]="step()"
          [stepper]="stepper()"
          [placeholder]="placeholder()"
        />
        @if (showSuffix()) {
          <span etInputSuffix>kg</span>
        }
        @if (hint()) {
          <et-hint>{{ hint() }}</et-hint>
        }
      </et-form-field>

      @if (showMixedState()) {
        <div class="text-sm opacity-60">
          <p>Raw form value: {{ demoForm.value().value() }}</p>
          <p>Mixed: {{ mixedState() }}</p>
        </div>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    ...FORM_FIELD_IMPORTS,
    ...NUMBER_INPUT_IMPORTS,
    InputPrefixDirective,
    InputSuffixDirective,
    FormField,
    ProvideColorDirective,
  ],
})
export class FormFieldNumberInputStorybookComponent {
  public appearance = input<FormFieldAppearance>(FORM_FIELD_APPEARANCES.BOX);
  public fill = input<FormFieldFill>(FORM_FIELD_FILLS.TRANSPARENT);
  public size = input<FormFieldSize>(FORM_FIELD_SIZES.MD);
  public labelMode = input<FormFieldLabelMode>(FORM_FIELD_LABEL_MODES.STATIC);
  public label = input('Label');
  public placeholder = input('0');
  public hint = input('');
  public value = input<number | null>(null);
  public mixed = input(false);
  public mixedLabel = input('Mixed');
  public showMixedState = input(false);
  public min = input<number | null>(null);
  public max = input<number | null>(null);
  public step = input<number | null>(null);
  public stepper = input(false);
  public disabled = input(false);
  public readonly = input(false);
  public required = input(false);
  public showPrefix = input(false);
  public showSuffix = input(false);
  public color = input('brand');

  public mixedState = linkedSignal(() => this.mixed());

  private formModel = linkedSignal(() => ({ value: this.value() }));

  public demoForm = form(this.formModel, (s) => {
    disabled(s, () => this.disabled());
    readonly(s.value, () => this.readonly());
    required(s.value, { when: () => this.required(), message: 'This field is required' });
  });
}
