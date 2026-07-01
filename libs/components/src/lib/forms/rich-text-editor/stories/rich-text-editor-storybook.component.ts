import { JsonPipe } from '@angular/common';
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
import { RICH_TEXT_EDITOR_IMPORTS } from '../rich-text-editor.imports';

@Component({
  selector: 'et-sb-form-field-rich-text-editor',
  template: `
    <div [etProvideColor]="color()" class="flex max-w-md flex-col gap-4 p-8 font-sans">
      <et-form-field [appearance]="appearance()" [fill]="fill()" [size]="size()" [labelMode]="labelMode()">
        <et-label>{{ label() }}</et-label>
        <et-rich-text-editor [formField]="demoForm.value" [placeholder]="placeholder()" />
        @if (hint()) {
          <et-hint>{{ hint() }}</et-hint>
        }
      </et-form-field>

      <pre class="rounded bg-black/5 p-3 text-xs whitespace-pre-wrap">{{
        demoForm.value().value() || '(empty value)'
      }}</pre>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...FORM_FIELD_IMPORTS, ...RICH_TEXT_EDITOR_IMPORTS, FormField, ProvideColorDirective, JsonPipe],
})
export class FormFieldRichTextEditorStorybookComponent {
  public appearance = input<FormFieldAppearance>(FORM_FIELD_APPEARANCES.BOX);
  public fill = input<FormFieldFill>(FORM_FIELD_FILLS.TRANSPARENT);
  public size = input<FormFieldSize>(FORM_FIELD_SIZES.MD);
  public labelMode = input<FormFieldLabelMode>(FORM_FIELD_LABEL_MODES.STATIC);
  public label = input('Description');
  public placeholder = input('Write something…');
  public hint = input('');
  public value = input('');
  public disabled = input(false);
  public required = input(false);
  public color = input('brand');

  private formModel = linkedSignal(() => ({ value: this.value() }));

  public demoForm = form(this.formModel, (s) => {
    disabled(s, () => this.disabled());
    required(s.value, { when: () => this.required(), message: 'This field is required' });
  });
}
