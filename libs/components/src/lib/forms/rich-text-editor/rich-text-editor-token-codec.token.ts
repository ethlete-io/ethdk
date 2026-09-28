import { InjectionToken } from '@angular/core';
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
