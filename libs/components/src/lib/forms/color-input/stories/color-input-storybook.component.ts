import { Component, input, linkedSignal, ViewEncapsulation } from '@angular/core';
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
import { COLOR_INPUT_IMPORTS } from '../color-input.imports';

@Component({
  selector: 'et-sb-form-field-color-input',
  template: `
    <div [etProvideColor]="color()" class="flex max-w-md flex-col gap-4 p-8 font-sans">
      <et-form-field [appearance]="appearance()" [fill]="fill()" [size]="size()" [labelMode]="labelMode()">
        <et-label>{{ label() }}</et-label>
        <et-color-input [(mixed)]="mixedState" [formField]="demoForm.value" [mixedLabel]="mixedLabel()" />
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
  imports: [...FORM_FIELD_IMPORTS, ...COLOR_INPUT_IMPORTS, FormField, ProvideColorDirective],
})
export class FormFieldColorInputStorybookComponent {
  public appearance = input<FormFieldAppearance>(FORM_FIELD_APPEARANCES.BOX);
  public fill = input<FormFieldFill>(FORM_FIELD_FILLS.TRANSPARENT);
  public size = input<FormFieldSize>(FORM_FIELD_SIZES.MD);
  public labelMode = input<FormFieldLabelMode>(FORM_FIELD_LABEL_MODES.STATIC);
  public label = input('Color');
  public hint = input('');
  public value = input<string | null>(null);
  public mixed = input(false);
  public mixedLabel = input('Mixed');
  public showMixedState = input(false);
  public disabled = input(false);
  public required = input(false);
  public color = input('brand');

  public mixedState = linkedSignal(() => this.mixed());

  private formModel = linkedSignal(() => ({ value: this.value() }));

  public demoForm = form(this.formModel, (s) => {
    disabled(s, () => this.disabled());
    required(s.value, { when: () => this.required(), message: 'This field is required' });
  });
}
