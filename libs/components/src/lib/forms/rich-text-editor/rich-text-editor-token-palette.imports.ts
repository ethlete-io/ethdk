import { RichTextEditorTokenPaletteComponent } from './rich-text-editor-token-palette.component';

/**
 * Opt-in click-to-insert token palette. Spread this into a component's `imports` alongside
 * `RICH_TEXT_EDITOR_IMPORTS` when the editor should be paired with a row of merge-field/placeholder
 * chip buttons. Kept separate so editors without a palette don't pull it in.
 */
export const RICH_TEXT_EDITOR_TOKEN_PALETTE_IMPORTS = [RichTextEditorTokenPaletteComponent] as const;
