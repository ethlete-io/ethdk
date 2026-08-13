import { booleanAttribute, Component, computed, inject, input, viewChild, ViewEncapsulation } from '@angular/core';
import {
  DEFAULT_RICH_TEXT_EDITOR_TOOLS,
  RICH_TEXT_EDITOR_IMPORTS,
  RichTextEditorComponent,
  RichTextEditorTool,
} from '../rich-text-editor';
import { MultiLanguageRichTextEditorDirective } from './headless/multi-language-rich-text-editor.directive';
import {
  provideRichTextEditorLanguageTool,
  RICH_TEXT_EDITOR_LANGUAGE_TOOL,
} from './tools/multi-language-rich-text-editor-language.provider';

@Component({
  selector: 'et-multi-language-rich-text-editor',
  templateUrl: './multi-language-rich-text-editor.component.html',
  styleUrl: './multi-language-rich-text-editor.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [...RICH_TEXT_EDITOR_IMPORTS],
  providers: [provideRichTextEditorLanguageTool()],
  hostDirectives: [
    {
      directive: MultiLanguageRichTextEditorDirective,
      inputs: ['value', 'touched', 'disabled', 'readonly', 'invalid', 'errors', 'required', 'name', 'languages'],
      outputs: ['valueChange', 'touchedChange'],
    },
  ],
  host: { class: 'et-multi-language-rich-text-editor' },
})
export class MultiLanguageRichTextEditorComponent {
  protected dir = inject(MultiLanguageRichTextEditorDirective);

  public placeholder = input('');
  public autoformat = input(true, { transform: booleanAttribute });

  /** Formatting tools for the embedded editor (the language switcher is prepended automatically).
   *  `null` uses the default toolbar. */
  public tools = input<readonly RichTextEditorTool[] | null>(null);

  private editor = viewChild(RichTextEditorComponent);

  /** The embedded editor's tools with the language switcher prepended, so it always leads the bar. */
  protected innerTools = computed<readonly RichTextEditorTool[]>(() => [
    RICH_TEXT_EDITOR_LANGUAGE_TOOL,
    'divider',
    ...(this.tools() ?? DEFAULT_RICH_TEXT_EDITOR_TOOLS),
  ]);

  public focus(options?: FocusOptions) {
    this.editor()?.focus(options);
  }
}
