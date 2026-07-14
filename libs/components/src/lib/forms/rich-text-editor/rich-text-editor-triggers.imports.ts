import { RichTextEditorTriggersDirective } from './headless';

/**
 * Opt-in building-block autocomplete. Spread this into a component's `imports` alongside
 * `RICH_TEXT_EDITOR_IMPORTS` when the editor needs `#`/`@`/… triggers. Kept separate from
 * `RICH_TEXT_EDITOR_IMPORTS` so editors that don't use triggers tree-shake the whole feature.
 */
export const RICH_TEXT_EDITOR_TRIGGERS_IMPORTS = [RichTextEditorTriggersDirective] as const;
