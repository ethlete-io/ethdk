import { validate } from '@angular/forms/signals';
import { MultiLanguageRichTextEditorValue } from './multi-language-rich-text-editor-config';

/** The path type `validate` accepts for a {@link MultiLanguageRichTextEditorValue} field. Derived so
 *  we don't depend on a non-exported path type name from `@angular/forms/signals`. */
type MultiLanguageRichTextEditorFieldPath = Parameters<typeof validate<MultiLanguageRichTextEditorValue>>[0];

export type RequiredLanguagesOptions = {
  /** Language codes that must have content for the field to be valid. */
  codes: readonly string[];
  /** Overrides the generated "Missing translations: …" message. */
  message?: string;
};

/**
 * Signal-forms validator: fails the field while any of the given language `codes` has no content
 * (trimmed Markdown is empty). Add it to your `form()` schema so a missing translation surfaces as
 * a normal form-field error (e.g. "Missing translations: en"), the same channel the single-language
 * editor uses. The per-language "Empty" flag in the switcher dropdown is independent and always shown.
 *
 * ```ts
 * form(model, (s) => {
 *   requiredLanguages(s.translations, { codes: ['en'] });
 * });
 * ```
 */
export const requiredLanguages = (
  path: MultiLanguageRichTextEditorFieldPath,
  { codes, message }: RequiredLanguagesOptions,
) =>
  validate(path, ({ value }) => {
    const missing = codes.filter((code) => (value()[code] ?? '').trim().length === 0);

    if (missing.length === 0) return undefined;

    return { kind: 'requiredLanguages', message: message ?? `Missing translations: ${missing.join(', ')}` };
  });
