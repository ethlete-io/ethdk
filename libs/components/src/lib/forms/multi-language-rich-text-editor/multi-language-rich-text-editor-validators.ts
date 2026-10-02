import { validate } from '@angular/forms/signals';
import { MultiLanguageRichTextEditorValue } from './multi-language-rich-text-editor-config';

/** The path type `validate` accepts for a {@link MultiLanguageRichTextEditorValue} field. Derived so
 *  we don't depend on a non-exported path type name from `@angular/forms/signals`. */
type MultiLanguageRichTextEditorFieldPath = Parameters<typeof validate<MultiLanguageRichTextEditorValue>>[0];

export type RequiredLanguagesOptions = {
  /** Language codes that must have content for the field to be valid. Pass a function to read
   *  them reactively (e.g. from a signal) - it is re-read on every validation. */
  codes: readonly string[] | (() => readonly string[]);
  /** Overrides the generated English "Missing translations: …" message. This is the localization
   *  path: a function receives the missing codes. */
  message?: string | ((missing: readonly string[]) => string);
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
    const missing = (typeof codes === 'function' ? codes() : codes).filter(
      (code) => (value()[code] ?? '').trim().length === 0,
    );

    if (missing.length === 0) return undefined;

    const text =
      typeof message === 'function' ? message(missing) : (message ?? `Missing translations: ${missing.join(', ')}`);

    return { kind: 'requiredLanguages', message: text };
  });
