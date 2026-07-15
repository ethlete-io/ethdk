import { computed, Directive, effect, input, linkedSignal, model } from '@angular/core';
import { FormValueControl, ValidationError } from '@angular/forms/signals';
import { RuntimeError } from '@ethlete/core';
import {
  MultiLanguageRichTextEditorLanguage,
  MultiLanguageRichTextEditorValue,
} from '../multi-language-rich-text-editor-config';
import { MULTI_LANGUAGE_RICH_TEXT_EDITOR_ERROR_CODES } from '../multi-language-rich-text-editor-errors';

@Directive({
  selector: '[etMultiLanguageRichTextEditor]',
})
export class MultiLanguageRichTextEditorDirective implements FormValueControl<MultiLanguageRichTextEditorValue> {
  public value = model<MultiLanguageRichTextEditorValue>({});
  public touched = model(false);
  public disabled = input(false);
  public readonly = input(false);
  public invalid = input(false);
  public errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  public required = input(false);
  public name = input('');

  /** The languages to offer, in switcher order. Consumer-provided — no languages are hard-wired. */
  public languages = input.required<readonly MultiLanguageRichTextEditorLanguage[]>();

  /** The language currently being edited. Kept valid across `languages` changing: if the active code
   *  is removed, it falls back to the first remaining language. */
  public activeLanguage = linkedSignal<readonly MultiLanguageRichTextEditorLanguage[], string>({
    source: this.languages,
    computation: (languages, previous) =>
      previous && languages.some((language) => language.code === previous.value)
        ? previous.value
        : (languages[0]?.code ?? ''),
  });

  /** Markdown of the active language — bound one-way into the embedded editor. */
  public activeMarkdown = computed(() => this.value()[this.activeLanguage()] ?? '');

  /** Languages configured but still without content — what the switcher flags as "missing". */
  public missingLanguages = computed(() => this.languages().filter((language) => !this.isFilled(language.code)));

  public filledCount = computed(() => this.languages().length - this.missingLanguages().length);
  public totalCount = computed(() => this.languages().length);

  /** Any language holds content (used e.g. for form-field label float). */
  public hasValue = computed(() => Object.values(this.value()).some((markdown) => markdown.trim().length > 0));

  constructor() {
    if (ngDevMode) {
      effect(() => this.assertLanguages(this.languages()));
    }
  }

  /** Whether the given language's stored Markdown is non-empty (trimmed). */
  public isFilled(code: string) {
    return (this.value()[code] ?? '').trim().length > 0;
  }

  /** Writes Markdown for the active language, preserving every other key — including translations
   *  whose code isn't currently in `languages()` (never dropped). */
  public writeActiveMarkdown(markdown: string) {
    const code = this.activeLanguage();

    this.value.update((record) => (record[code] === markdown ? record : { ...record, [code]: markdown }));
  }

  private assertLanguages(languages: readonly MultiLanguageRichTextEditorLanguage[]) {
    if (languages.length === 0) {
      throw new RuntimeError(
        MULTI_LANGUAGE_RICH_TEXT_EDITOR_ERROR_CODES.NO_LANGUAGES_CONFIGURED,
        '[etMultiLanguageRichTextEditor] requires at least one language in its `languages` input.',
      );
    }

    const seen = new Set<string>();

    for (const language of languages) {
      if (seen.has(language.code)) {
        throw new RuntimeError(
          MULTI_LANGUAGE_RICH_TEXT_EDITOR_ERROR_CODES.DUPLICATE_LANGUAGE_CODE,
          `[etMultiLanguageRichTextEditor] has a duplicate language code "${language.code}". Codes must be unique.`,
        );
      }

      seen.add(language.code);
    }
  }
}
