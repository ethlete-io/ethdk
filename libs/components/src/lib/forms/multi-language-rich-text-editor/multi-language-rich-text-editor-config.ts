/**
 * A single language the multi-language rich text editor can switch between. The list is entirely
 * consumer-provided (via the `languages` input) — the editor hard-wires no languages of its own.
 */
export type MultiLanguageRichTextEditorLanguage = {
  /** Stable key this language's Markdown is stored under in the value record (e.g. `'en'`, `'de'`). */
  code: string;
  /** Human-readable name shown in the switcher dropdown (e.g. `'English'`). */
  label: string;
  /** Optional icon token (e.g. a flag) rendered next to the label in the dropdown. */
  icon?: string;
};

/** The value shape of the multi-language editor: each language `code` mapped to its Markdown. */
export type MultiLanguageRichTextEditorValue = Record<string, string>;
