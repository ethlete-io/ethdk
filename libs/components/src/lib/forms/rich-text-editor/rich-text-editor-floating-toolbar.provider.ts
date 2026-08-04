import { Provider } from '@angular/core';
import { setupRichTextEditorFloatingToolbar } from './headless/rich-text-editor-floating-toolbar.directive';
import { RICH_TEXT_EDITOR_FLOATING_TOOLBAR } from './rich-text-editor-floating-toolbar.token';

/**
 * Gives every `et-rich-text-editor` in scope the toolbar that follows the selection: selecting text
 * with a pointer or the keyboard floats the inline marks (bold, italic, underline, strikethrough,
 * code and - with the link tool - link) above the selected text.
 *
 * Without this provider the editor keeps its static toolbar, and the floating one, with the overlay
 * runtime and anchored positioning it pulls in, never reaches the bundle.
 *
 * @example
 * providers: [provideRichTextEditorFloatingToolbar()]
 */
export const provideRichTextEditorFloatingToolbar = (): Provider => ({
  provide: RICH_TEXT_EDITOR_FLOATING_TOOLBAR,
  useValue: setupRichTextEditorFloatingToolbar,
});
