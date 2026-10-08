import { JsonPipe } from '@angular/common';
import { Component, linkedSignal, ViewEncapsulation } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { ProvideColorDirective } from '@ethlete/core';
import { FORM_FIELD_IMPORTS } from '../../form-field';
import {
  createRichTextEditorTrigger,
  RICH_TEXT_EDITOR_TOKEN_PALETTE_IMPORTS,
  RichTextEditorTrigger,
  RichTextEditorTriggerItem,
} from '../../rich-text-editor';
import { MultiLanguageRichTextEditorValue } from '../multi-language-rich-text-editor-config';
import { MULTI_LANGUAGE_RICH_TEXT_EDITOR_IMPORTS } from '../multi-language-rich-text-editor.imports';

const PLACEHOLDERS: RichTextEditorTriggerItem[] = [
  { id: 'firstName', label: 'First name' },
  { id: 'company', label: 'Company' },
  { id: 'unsubscribeUrl', label: 'Unsubscribe link' },
];

const TRIGGERS: RichTextEditorTrigger[] = [
  createRichTextEditorTrigger({
    char: '#',
    type: 'placeholder',
    items: PLACEHOLDERS,
    resolveItem: (id) => PLACEHOLDERS.find((item) => item.id === id) ?? null,
  }),
];

@Component({
  selector: 'et-sb-multi-language-rich-text-editor-triggers',
  template: `
    <div
      class="flex max-w-2xl flex-col gap-4 p-8 font-sans"
      style="--et-rich-text-editor-min-height: 180px"
      etProvideColor="brand"
    >
      <et-form-field>
        <et-label>Email body</et-label>
        <et-multi-language-rich-text-editor
          #body
          [formField]="demoForm.translations"
          [languages]="LANGUAGES"
          [triggers]="TRIGGERS"
          placeholder="Type # for a merge field, or click one below…"
        />
      </et-form-field>

      @if (body.editor(); as editor) {
        <et-rich-text-editor-token-palette [editor]="editor" [triggers]="TRIGGERS" />
      }

      <pre class="rounded bg-black/5 p-3 text-small whitespace-pre-wrap">{{
        demoForm.translations().value() | json
      }}</pre>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    ...FORM_FIELD_IMPORTS,
    ...MULTI_LANGUAGE_RICH_TEXT_EDITOR_IMPORTS,
    ...RICH_TEXT_EDITOR_TOKEN_PALETTE_IMPORTS,
    FormField,
    ProvideColorDirective,
    JsonPipe,
  ],
})
export class MultiLanguageRichTextEditorTriggersStorybookComponent {
  protected readonly TRIGGERS = TRIGGERS;

  protected readonly LANGUAGES = [
    { code: 'en', label: 'English' },
    { code: 'de', label: 'Deutsch' },
  ];

  private formModel = linkedSignal<{ translations: MultiLanguageRichTextEditorValue }>(() => ({
    translations: { en: 'Hello {{placeholder:firstName}},', de: 'Hallo {{placeholder:firstName}},' },
  }));

  public demoForm = form(this.formModel);
}
