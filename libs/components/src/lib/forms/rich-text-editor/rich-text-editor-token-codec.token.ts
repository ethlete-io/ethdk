import { InjectionToken } from '@angular/core';
// type-only import: erased at build time, so the base editor's import graph never pulls the codec
// implementation (chip builders, regex) — that lives behind the opt-in directive / render provider.
import { RichTextEditorTokenCodec } from './headless/internals/rich-text-editor-token';

/**
 * Optional codec the base editor uses to (de)serialize `{{type:id}}` token chips. Installed
 * either by `[etRichTextEditorTriggers]` (interactive authoring) or by
 * `provideRichTextEditorTokenRendering` (display/read-only rendering). Absent → the editor
 * treats token markdown as plain text.
 */
export const RICH_TEXT_EDITOR_TOKEN_CODEC = new InjectionToken<RichTextEditorTokenCodec>(
  'RICH_TEXT_EDITOR_TOKEN_CODEC',
);
