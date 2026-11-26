import { Provider } from '@angular/core';
import { DEFAULT_RICH_TEXT_EDITOR_LABELS, provideRichTextEditorTool } from '../../rich-text-editor';
import { MultiLanguageRichTextEditorLanguageToolComponent } from './multi-language-rich-text-editor-language-tool.component';

/** The toolbar token the language switcher renders for. Include it in the editor's `tools` to place
 *  the switcher; `et-multi-language-rich-text-editor` prepends it automatically. */
export const RICH_TEXT_EDITOR_LANGUAGE_TOOL = 'language';

/**
 * Registers the `'language'` toolbar tool (the multi-language switcher dropdown). The
 * `et-multi-language-rich-text-editor` component provides this itself and auto-includes the token in
 * the embedded editor's `tools`, so consumers don't wire it manually. The switcher only works inside
 * an `[etMultiLanguageRichTextEditor]`; anywhere else it reports `ET2602`.
 */
export const provideRichTextEditorLanguageTool = (): Provider =>
  provideRichTextEditorTool({
    token: RICH_TEXT_EDITOR_LANGUAGE_TOOL,
    label: DEFAULT_RICH_TEXT_EDITOR_LABELS.language,
    control: MultiLanguageRichTextEditorLanguageToolComponent,
  });
