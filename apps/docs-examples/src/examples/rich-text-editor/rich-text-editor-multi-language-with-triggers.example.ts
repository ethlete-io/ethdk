import { JsonPipe } from '@angular/common';
import { Component, signal, ViewEncapsulation } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import {
  FORM_FIELD_IMPORTS,
  MULTI_LANGUAGE_RICH_TEXT_EDITOR_IMPORTS,
  MultiLanguageRichTextEditorValue,
  RICH_TEXT_EDITOR_TOKEN_PALETTE_IMPORTS,
  RichTextEditorTrigger,
  RichTextEditorTriggerItem,
  createRichTextEditorTrigger,
} from '@ethlete/components';

const PLACEHOLDERS: RichTextEditorTriggerItem[] = [
  { id: 'firstName', label: 'First name' },
  { id: 'company', label: 'Company' },
  { id: 'unsubscribeUrl', label: 'Unsubscribe link' },
];

@Component({
  selector: 'app-rich-text-editor-multi-language-with-triggers-example',
  template: `
    <et-form-field>
      <et-label>Email body</et-label>
      <et-multi-language-rich-text-editor
        #body
        [formField]="emailForm.translations"
        [languages]="LANGUAGES"
        [triggers]="TRIGGERS"
        placeholder="Type # for a merge field, or click one below…"
      />
    </et-form-field>

    @if (body.editor(); as editor) {
      <et-rich-text-editor-token-palette [editor]="editor" [triggers]="TRIGGERS" />
    }

    <pre>{{ emailForm.translations().value() | json }}</pre>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    FORM_FIELD_IMPORTS,
    MULTI_LANGUAGE_RICH_TEXT_EDITOR_IMPORTS,
    RICH_TEXT_EDITOR_TOKEN_PALETTE_IMPORTS,
    FormField,
    JsonPipe,
  ],
})
export class RichTextEditorMultiLanguageWithTriggersExampleComponent {
  protected readonly TRIGGERS: RichTextEditorTrigger[] = [
    createRichTextEditorTrigger({
      char: '#',
      type: 'placeholder',
      items: PLACEHOLDERS,
      resolveItem: (id) => PLACEHOLDERS.find((item) => item.id === id) ?? null,
    }),
  ];

  protected readonly LANGUAGES = [
    { code: 'en', label: 'English' },
    { code: 'de', label: 'Deutsch' },
  ];

  private model = signal<{ translations: MultiLanguageRichTextEditorValue }>({
    translations: { en: 'Hello {{placeholder:firstName}},', de: 'Hallo {{placeholder:firstName}},' },
  });

  protected emailForm = form(this.model);
}
