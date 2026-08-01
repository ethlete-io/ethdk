import { Component, computed, ViewEncapsulation, input } from '@angular/core';
import { injectHasTouchInput } from '@ethlete/core';
import { BUTTON_IMPORTS } from '../../../button';
import {
  HEADING_1_ICON,
  HEADING_2_ICON,
  HEADING_3_ICON,
  IconDirective,
  PARAGRAPH_ICON,
  provideIcons,
} from '../../../icon';
import { MENU_IMPORTS } from '../../../menu';
import { RichTextEditorDirective } from '../headless/rich-text-editor.directive';
import { DEFAULT_RICH_TEXT_EDITOR_LABELS } from '../rich-text-editor-labels';

const richTextEditorHeadingOptions = (): readonly { level: number | null; label: string; icon: string }[] => [
  { level: null, label: DEFAULT_RICH_TEXT_EDITOR_LABELS.paragraph, icon: 'et-paragraph' },
  { level: 1, label: DEFAULT_RICH_TEXT_EDITOR_LABELS.heading(1), icon: 'et-heading-1' },
  { level: 2, label: DEFAULT_RICH_TEXT_EDITOR_LABELS.heading(2), icon: 'et-heading-2' },
  { level: 3, label: DEFAULT_RICH_TEXT_EDITOR_LABELS.heading(3), icon: 'et-heading-3' },
];

/** Block-style options for the heading menu. `null` is a normal paragraph. */
export const RICH_TEXT_EDITOR_HEADING_OPTIONS = /* @__PURE__ */ richTextEditorHeadingOptions();

/**
 * The opt-in `'heading'` tool's toolbar control: a menu of block styles (paragraph, H1, H2, H3).
 * Registered via `provideRichTextEditorHeadingTool`.
 */
@Component({
  selector: 'et-rich-text-editor-heading-tool',
  templateUrl: './rich-text-editor-heading-tool.component.html',
  styleUrl: './rich-text-editor-heading-tool.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [...BUTTON_IMPORTS, IconDirective, ...MENU_IMPORTS],
  providers: [provideIcons(PARAGRAPH_ICON, HEADING_1_ICON, HEADING_2_ICON, HEADING_3_ICON)],
  host: { class: 'et-rte-heading-tool' },
})
export class RichTextEditorHeadingToolComponent {
  /** On touch, open the menu without stealing focus so the keyboard (and docked toolbar) stay put. */
  protected hasTouchInput = injectHasTouchInput();

  public editor = input.required<RichTextEditorDirective>();

  /** The editor's strings - the tool is part of that editor's toolbar. */
  protected labels = computed(() => this.editor().resolvedLabels());

  /** The menu's entries, named by the label set rather than by the option table. */
  protected options = computed(() => {
    const labels = this.labels();

    return RICH_TEXT_EDITOR_HEADING_OPTIONS.map((option) => ({
      ...option,
      label: option.level === null ? labels.paragraph : labels.heading(option.level),
    }));
  });

  private current = computed(() => this.options().find((option) => option.level === this.editor().headingLevel()));

  protected currentLabel = computed(() => this.current()?.label ?? this.labels().paragraph);
  protected currentIcon = computed(() => this.current()?.icon ?? 'et-paragraph');

  protected disabled = computed(
    () => this.editor().disabled() || this.editor().readonly() || this.editor().headingToolDisabled(),
  );

  protected select(level: unknown) {
    this.editor().setHeading(level as number | null);
    // the menu overlay pulled focus off the editor; hand it back (deferred so it wins over the
    // menu's own focus restoration on close) so the re-applied selection stays live in the editor.
    queueMicrotask(() => this.editor().activate());
  }
}
