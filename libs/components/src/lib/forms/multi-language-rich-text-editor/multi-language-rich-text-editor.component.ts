import {
  booleanAttribute,
  Component,
  computed,
  effect,
  inject,
  input,
  untracked,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { ACCESSIBLE_NAME_INPUTS } from '../form-field/headless';
import {
  DEFAULT_RICH_TEXT_EDITOR_TOOLS,
  injectRichTextEditorTools,
  RICH_TEXT_EDITOR_TOOL_BUTTONS,
  RICH_TEXT_EDITOR_TOOLS,
  RICH_TEXT_EDITOR_IMPORTS,
  RichTextEditorComponent,
  RichTextEditorDirective,
  RichTextEditorTool,
} from '../rich-text-editor';
import { injectRegisteredRichTextEditorTools } from '../rich-text-editor/headless/internals/rich-text-editor-registered-tools';
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
      inputs: [
        'value',
        'touched',
        'disabled',
        'readonly',
        'hidden',
        'invalid',
        'errors',
        'required',
        'name',
        'languages',
        'labels',
        ...ACCESSIBLE_NAME_INPUTS,
      ],
      outputs: ['valueChange', 'touchedChange', 'touch'],
    },
  ],
  host: { class: 'et-multi-language-rich-text-editor' },
})
export class MultiLanguageRichTextEditorComponent {
  protected dir = inject(MultiLanguageRichTextEditorDirective);
  private toolsConfig = injectRichTextEditorTools();
  public placeholder = input('');

  public autoformat = input(true, { transform: booleanAttribute });
  /** Formatting tools for the embedded editor (the language switcher is prepended automatically).
   *  `null` uses the tools from `provideRichTextEditorTools`, or the default toolbar. */
  public tools = input<readonly RichTextEditorTool[] | null>(null);

  private editor = viewChild(RichTextEditorComponent);

  private editorDir = viewChild(RichTextEditorComponent, { read: RichTextEditorDirective });
  private registeredTokens = new Set(injectRegisteredRichTextEditorTools().map((tool) => tool.token));

  /** The embedded editor's tools with the language switcher prepended, so it always leads the bar. */
  protected innerTools = computed<readonly RichTextEditorTool[]>(() => [
    RICH_TEXT_EDITOR_LANGUAGE_TOOL,
    'divider',
    ...(this.tools() ?? this.providedTools()),
  ]);

  constructor() {
    let renderedLanguage: string | null = null;

    // The embedded editor re-renders only for a value that differs from what it last emitted, so a
    // switch to a language holding the same text would keep the previous language's undo history.
    effect(() => {
      const language = this.dir.activeLanguage();
      const editor = this.editorDir();

      if (!editor) return;

      if (renderedLanguage !== null && renderedLanguage !== language) {
        untracked(() => editor.renderExternalValue(this.dir.activeMarkdown()));
      }

      renderedLanguage = language;
    });
  }

  public focus(options?: FocusOptions) {
    this.editor()?.focus(options);
  }

  private providedTools() {
    const { tools } = this.toolsConfig;

    if (tools !== DEFAULT_RICH_TEXT_EDITOR_TOOLS) return tools;

    return tools.filter(
      (tool) =>
        tool === RICH_TEXT_EDITOR_TOOLS.DIVIDER ||
        !!RICH_TEXT_EDITOR_TOOL_BUTTONS[tool as keyof typeof RICH_TEXT_EDITOR_TOOL_BUTTONS] ||
        this.registeredTokens.has(tool),
    );
  }
}
