import { JsonPipe } from '@angular/common';
import { Component, signal, ViewEncapsulation } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import {
  FORM_FIELD_IMPORTS,
  MULTI_LANGUAGE_RICH_TEXT_EDITOR_IMPORTS,
  MultiLanguageRichTextEditorValue,
  provideRichTextEditorHeadingTool,
} from '@ethlete/components';

@Component({
  selector: 'app-rich-text-editor-multi-language-with-existing-translations-example',
  template: `
    <et-form-field>
      <et-label>Description</et-label>
      <et-multi-language-rich-text-editor
        [formField]="descriptionForm.translations"
        [languages]="LANGUAGES"
        placeholder="Write something…"
      />
    </et-form-field>

    <pre>{{ descriptionForm.translations().value() | json }}</pre>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, MULTI_LANGUAGE_RICH_TEXT_EDITOR_IMPORTS, FormField, JsonPipe],
  providers: [provideRichTextEditorHeadingTool()],
})
export class RichTextEditorMultiLanguageWithExistingTranslationsExampleComponent {
  protected readonly LANGUAGES = [
    { code: 'en', label: 'English' },
    { code: 'de', label: 'Deutsch' },
    { code: 'fr', label: 'Français' },
  ];

  private model = signal<{ translations: MultiLanguageRichTextEditorValue }>({
    translations: {
      en: '# Welcome\n\nAn intro in **English**.',
      de: '# Willkommen\n\nEine Einführung auf **Deutsch**.',
    },
  });

  protected descriptionForm = form(this.model);
}
