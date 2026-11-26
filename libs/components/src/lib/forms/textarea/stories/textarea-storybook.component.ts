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
import { TEXTAREA_IMPORTS } from '../textarea.imports';

@Component({
  selector: 'et-sb-form-field-textarea',
  template: `
    <div [etProvideColor]="color()" class="flex max-w-md flex-col gap-4 p-8 font-sans">
      <et-form-field [appearance]="appearance()" [fill]="fill()" [size]="size()" [labelMode]="labelMode()">
        <et-label>{{ label() }}</et-label>
        <et-textarea
          [(mixed)]="mixedState"
          [formField]="demoForm.value"
          [mixedLabel]="mixedLabel()"
          [placeholder]="placeholder()"
          [rows]="rows()"
          [autosize]="autosize()"
          [minRows]="minRows()"
          [maxRows]="maxRows()"
          [resize]="resize()"
        />
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
  imports: [...FORM_FIELD_IMPORTS, ...TEXTAREA_IMPORTS, FormField, ProvideColorDirective],
})
export class FormFieldTextareaStorybookComponent {
  public appearance = input<FormFieldAppearance>(FORM_FIELD_APPEARANCES.BOX);
  public fill = input<FormFieldFill>(FORM_FIELD_FILLS.TRANSPARENT);
  public size = input<FormFieldSize>(FORM_FIELD_SIZES.MD);
  public labelMode = input<FormFieldLabelMode>(FORM_FIELD_LABEL_MODES.STATIC);
  public label = input('Label');
  public placeholder = input('Placeholder');
  public hint = input('');
  public value = input('');
  public mixed = input(false);
  public mixedLabel = input('Mixed');
  public showMixedState = input(false);
  public rows = input(3);
  public autosize = input(true);
  public minRows = input<number | null>(null);
  public maxRows = input<number | null>(null);
  public resize = input<'none' | 'vertical'>('vertical');
  public disabled = input(false);
  public readonly = input(false);
  public required = input(false);
  public color = input('brand');

  public mixedState = linkedSignal(() => this.mixed());

  private formModel = linkedSignal(() => ({ value: this.value() }));

  public demoForm = form(this.formModel, (s) => {
    disabled(s, () => this.disabled());
    readonly(s.value, () => this.readonly());
    required(s.value, { when: () => this.required(), message: 'This field is required' });
  });
}
