import { Component, ViewEncapsulation, input, linkedSignal } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { FormField, disabled, form, readonly } from '@angular/forms/signals';
import { ProvideColorDirective } from '@ethlete/core';
import {
  FORM_FIELD_APPEARANCES,
  FORM_FIELD_FILLS,
  FORM_FIELD_IMPORTS,
  FORM_FIELD_SIZES,
  FormFieldAppearance,
  FormFieldFill,
  FormFieldSize,
} from '../../form-field';
import { TAG_INPUT_IMPORTS } from '../tag-input.imports';

@Component({
  selector: 'et-sb-tag-input',
  template: `
    <div [etProvideColor]="color()" class="flex max-w-md flex-col gap-4 p-8 font-sans">
      <et-form-field [appearance]="appearance()" [fill]="fill()" [size]="size()">
        <et-label>{{ label() }}</et-label>
        <et-tag-input
          [(mixed)]="mixedState"
          [formField]="demoForm.value"
          [mixedLabel]="mixedLabel()"
          [placeholder]="placeholder()"
          [allowDuplicates]="allowDuplicates()"
          [maxTags]="maxTags()"
        />
        @if (hint()) {
          <et-hint>{{ hint() }}</et-hint>
        }
      </et-form-field>

      @if (showMixedState()) {
        <div class="text-sm opacity-60">
          <p>Raw form value: {{ demoForm.value().value() | json }}</p>
          <p>Mixed: {{ mixedState() }}</p>
        </div>
      } @else {
        <p class="text-sm opacity-60">Form value: {{ demoForm.value().value() | json }}</p>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [...FORM_FIELD_IMPORTS, ...TAG_INPUT_IMPORTS, FormField, JsonPipe, ProvideColorDirective],
})
export class TagInputStorybookComponent {
  public appearance = input<FormFieldAppearance>(FORM_FIELD_APPEARANCES.BOX);
  public fill = input<FormFieldFill>(FORM_FIELD_FILLS.TRANSPARENT);
  public size = input<FormFieldSize>(FORM_FIELD_SIZES.MD);
  public label = input('Tags');
  public placeholder = input('Add a tag…');
  public hint = input('Enter or comma commits a tag');
  public value = input<string[]>([]);
  public mixed = input(false);
  public mixedLabel = input('Mixed');
  public showMixedState = input(false);
  public allowDuplicates = input(false);
  public maxTags = input<number | undefined>(undefined);
  public disabled = input(false);
  public readonly = input(false);
  public color = input('brand');

  public mixedState = linkedSignal(() => this.mixed());

  private formModel = linkedSignal(() => ({ value: this.value() }));

  public demoForm = form(this.formModel, (s) => {
    disabled(s, () => this.disabled());
    readonly(s.value, () => this.readonly());
  });
}
