import { InjectionToken } from '@angular/core';
import { RichTextEditorDirective } from './headless/rich-text-editor.directive';

/**
 * Wires the selection toolbar to one editor instance. Called from the editor's constructor (an
 * injection context), so an implementation may `inject()`.
 */
export type RichTextEditorFloatingToolbarSetup = (editor: RichTextEditorDirective) => void;

/**
 * The selection toolbar's wiring, registered by `provideRichTextEditorFloatingToolbar()`. Absent
 * means the editor shows its static toolbar only.
 */
export const RICH_TEXT_EDITOR_FLOATING_TOOLBAR = new InjectionToken<RichTextEditorFloatingToolbarSetup>(
  'RichTextEditorFloatingToolbar',
);
