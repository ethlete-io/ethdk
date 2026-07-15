import { Provider } from '@angular/core';
import { RICH_TEXT_EDITOR_TOOL, RichTextEditorToolDefinition } from '../../rich-text-editor';
import { MultiLanguageRichTextEditorLanguageToolComponent } from './multi-language-rich-text-editor-language-tool.component';

/** The toolbar token the language switcher renders for. Include it in the editor's `tools` to place
 *  the switcher; `et-multi-language-rich-text-editor` prepends it automatically. */
export const RICH_TEXT_EDITOR_LANGUAGE_TOOL = 'language';

/**
 * Registers the `'language'` toolbar tool (the multi-language switcher dropdown). The
 * `et-multi-language-rich-text-editor` component provides this itself and auto-includes the token in
 * the embedded editor's `tools`, so consumers don't wire it manually. Exported for advanced setups
 * that compose the switcher into a bare `<et-rich-text-editor>`.
 */
export const provideRichTextEditorLanguageTool = (): Provider => ({
  provide: RICH_TEXT_EDITOR_TOOL,
  useValue: {
    token: RICH_TEXT_EDITOR_LANGUAGE_TOOL,
    label: 'Language',
    control: MultiLanguageRichTextEditorLanguageToolComponent,
  } satisfies RichTextEditorToolDefinition,
  multi: true,
});
