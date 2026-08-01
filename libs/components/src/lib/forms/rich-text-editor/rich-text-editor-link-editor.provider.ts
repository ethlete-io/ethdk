import { Provider } from '@angular/core';
import { setupRichTextEditorLinkEditor } from './headless/rich-text-editor-link-editor.directive';
import { RICH_TEXT_EDITOR_LINK_EDITOR } from './rich-text-editor-link-editor.token';

/**
 * Gives every `et-rich-text-editor` in scope the link editor popover: the `'link'` tool then opens a
 * form (URL, text, "open in new tab", remove) anchored to the selection instead of the browser's
 * `prompt()`.
 *
 * Without this provider the editor keeps working — the link tool falls back to `window.prompt` — and
 * the popover, with the form controls and overlay strategies it pulls in, never reaches the bundle.
 *
 * @example
 * providers: [provideRichTextEditorLinkEditor()]
 */
export const provideRichTextEditorLinkEditor = (): Provider => ({
  provide: RICH_TEXT_EDITOR_LINK_EDITOR,
  useValue: setupRichTextEditorLinkEditor,
});
