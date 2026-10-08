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
import { FIELD_STATE_INPUTS } from '../form-field/headless/field-state-control.directive';
import {
  DEFAULT_RICH_TEXT_EDITOR_TOOLS,
  injectRichTextEditorTools,
  RICH_TEXT_EDITOR_TOOL_BUTTONS,
  RICH_TEXT_EDITOR_TOOLS,
  RICH_TEXT_EDITOR_IMPORTS,
  RICH_TEXT_EDITOR_TRIGGERS_IMPORTS,
  RichTextEditorComponent,
  RichTextEditorDirective,
  RichTextEditorTool,
  RichTextEditorTrigger,
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
  imports: [...RICH_TEXT_EDITOR_IMPORTS, ...RICH_TEXT_EDITOR_TRIGGERS_IMPORTS],
  providers: [provideRichTextEditorLanguageTool()],
  hostDirectives: [
    {
      directive: MultiLanguageRichTextEditorDirective,
      inputs: [
        'value',
        'touched',
        'disabled',
        'readonly',
        'invalid',
        'errors',
        'required',
        'name',
        'languages',
        'labels',
        ...ACCESSIBLE_NAME_INPUTS,
        ...FIELD_STATE_INPUTS,
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

  /** `#`/`@`/… token triggers for the embedded editor, the same as `[triggers]` with
   *  `etRichTextEditorTriggers` on a single editor. `null` leaves the editor without triggers. */
  public triggers = input<readonly RichTextEditorTrigger[] | null>(null);

  /** Passed to the embedded editor's `etRichTextEditorTriggers`. */
  public parsePastedTokens = input(true, { transform: booleanAttribute });

  private editorComponent = viewChild(RichTextEditorComponent);

  /** The embedded editor, for `insertToken()` and `et-rich-text-editor-token-palette`'s `[editor]`.
   *  Every language is edited in this one instance. `undefined` until it renders. */
  public editor = viewChild(RichTextEditorComponent, { read: RichTextEditorDirective });
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
      const editor = this.editor();

      if (!editor) return;

      if (renderedLanguage !== null && renderedLanguage !== language) {
        untracked(() => editor.renderExternalValue(this.dir.activeMarkdown()));
      }

      renderedLanguage = language;
    });
  }

  public focus(options?: FocusOptions) {
    this.editorComponent()?.focus(options);
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
