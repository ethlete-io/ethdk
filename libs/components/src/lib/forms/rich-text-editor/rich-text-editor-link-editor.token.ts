import { InjectionToken } from '@angular/core';
import { RichTextEditorDirective } from './headless/rich-text-editor.directive';

/**
 * Wires the link editor popover to one editor instance. Called from the editor's constructor (an
 * injection context), so an implementation may `inject()`.
 */
export type RichTextEditorLinkEditorSetup = (editor: RichTextEditorDirective, host: HTMLElement) => void;

/**
 * The link editor popover's wiring, registered by `provideRichTextEditorLinkEditor()`. Absent means
 * the link tool falls back to `window.prompt`.
 */
export const RICH_TEXT_EDITOR_LINK_EDITOR = new InjectionToken<RichTextEditorLinkEditorSetup>(
  'RichTextEditorLinkEditor',
);
