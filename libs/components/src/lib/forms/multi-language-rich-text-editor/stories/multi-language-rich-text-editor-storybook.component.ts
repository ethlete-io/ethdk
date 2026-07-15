import { JsonPipe } from '@angular/common';
import { Component, computed, input, linkedSignal, ViewEncapsulation } from '@angular/core';
import { disabled, form, FormField, readonly } from '@angular/forms/signals';
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
import { MultiLanguageRichTextEditorValue } from '../multi-language-rich-text-editor-config';
import { requiredLanguages } from '../multi-language-rich-text-editor-validators';
import { MULTI_LANGUAGE_RICH_TEXT_EDITOR_IMPORTS } from '../multi-language-rich-text-editor.imports';

@Component({
  selector: 'et-sb-form-field-multi-language-rich-text-editor',
  template: `
    <div
      [etProvideColor]="color()"
      class="flex max-w-2xl flex-col gap-4 p-8 font-sans"
      style="--et-rich-text-editor-min-height: 220px"
    >
      <et-form-field [appearance]="appearance()" [fill]="fill()" [size]="size()" [labelMode]="labelMode()">
        <et-label>{{ label() }}</et-label>
        <et-multi-language-rich-text-editor
          [formField]="demoForm.translations"
          [languages]="languages()"
          [placeholder]="placeholder()"
        />
        @if (hint()) {
          <et-hint>{{ hint() }}</et-hint>
        }
      </et-form-field>

      <pre class="rounded bg-black/5 p-3 text-xs whitespace-pre-wrap">{{ demoForm.translations().value() | json }}</pre>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    ...FORM_FIELD_IMPORTS,
    ...MULTI_LANGUAGE_RICH_TEXT_EDITOR_IMPORTS,
    FormField,
    ProvideColorDirective,
    JsonPipe,
  ],
})
export class FormFieldMultiLanguageRichTextEditorStorybookComponent {
  public languages = input<{ code: string; label: string }[]>([
    { code: 'en', label: 'English' },
    { code: 'de', label: 'Deutsch' },
    { code: 'fr', label: 'Français' },
  ]);

  public appearance = input<FormFieldAppearance>(FORM_FIELD_APPEARANCES.BOX);
  public fill = input<FormFieldFill>(FORM_FIELD_FILLS.TRANSPARENT);
  public size = input<FormFieldSize>(FORM_FIELD_SIZES.MD);
  public labelMode = input<FormFieldLabelMode>(FORM_FIELD_LABEL_MODES.STATIC);
  public label = input('Description');
  public placeholder = input('Write something…');
  public hint = input('');
  public value = input<MultiLanguageRichTextEditorValue>({});
  public disabled = input(false);
  public readonly = input(false);
  /** When set, requires content for these language codes (surfaces as a form-field error). */
  public requireLanguages = input<readonly string[]>([]);
  public color = input('brand');

  private formModel = linkedSignal(() => ({ translations: this.value() }));
  private requiredCodes = computed(() => this.requireLanguages());

  public demoForm = form(this.formModel, (s) => {
    disabled(s, () => this.disabled());
    readonly(s.translations, () => this.readonly());
    requiredLanguages(s.translations, { codes: this.requiredCodes() });
  });
}
