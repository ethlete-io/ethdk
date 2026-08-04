import { Component, computed, effect, inject, input, untracked, ViewEncapsulation } from '@angular/core';
import { AutoSurfaceDirective, COLOR_PROVIDER, ProvideColorDirective } from '@ethlete/core';
import { IconButtonComponent } from '../../button/icon-button.component';
import {
  BOLD_ICON,
  CODE_ICON,
  IconDirective,
  ITALIC_ICON,
  LINK_ICON,
  provideIcons,
  STRIKETHROUGH_ICON,
  UNDERLINE_ICON,
} from '../../icon';
import { RichTextEditorDirective } from './headless/rich-text-editor.directive';
import { richTextEditorToolLabel } from './rich-text-editor-labels';
import {
  RICH_TEXT_EDITOR_INLINE_TOOLS,
  RICH_TEXT_EDITOR_TOOLS,
  RichTextEditorToolDefinition,
} from './rich-text-editor-tools';

@Component({
  selector: 'et-rich-text-editor-floating-toolbar',
  templateUrl: './rich-text-editor-floating-toolbar.component.html',
  styleUrl: './rich-text-editor-floating-toolbar.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [IconButtonComponent, IconDirective],
  providers: [provideIcons(BOLD_ICON, ITALIC_ICON, UNDERLINE_ICON, STRIKETHROUGH_ICON, CODE_ICON, LINK_ICON)],
  hostDirectives: [ProvideColorDirective, AutoSurfaceDirective],
  host: {
    class: 'et-rte-floating-toolbar',
    role: 'toolbar',
    '[attr.aria-label]': 'labels().selectionToolbar',
    // keep the caret/selection in the editor when the user clicks a button
    '(mousedown)': '$event.preventDefault()',
  },
})
export class RichTextEditorFloatingToolbarComponent {
  private ownColorProvider = inject(ProvideColorDirective);
  private contextColorProvider = inject(COLOR_PROVIDER, { optional: true, skipSelf: true });

  /** The editor whose selection this toolbar formats (passed in - the toolbar is detached from the DOM). */
  public editor = input.required<RichTextEditorDirective>();

  protected readonly TOOLS = RICH_TEXT_EDITOR_TOOLS;

  /** The editor's strings - the same set, since this toolbar is part of that editor. */
  protected labels = computed(() => this.editor().resolvedLabels());

  /** The inline marks from the editor's configured tools - headings/lists stay in the static toolbar.
   *  A token whose tool was not provided has no definition and is dropped, same as in that bar. */
  protected inlineTools = computed(() => {
    const defs = this.editor().toolDefs;

    return this.editor()
      .resolvedTools()
      .filter((tool) => RICH_TEXT_EDITOR_INLINE_TOOLS.includes(tool) && defs.has(tool))
      .map((tool) => defs.get(tool) as RichTextEditorToolDefinition);
  });

  constructor() {
    // Detached overlay pane: the toolbar's surface IS the overlay's own surface, so it paints the
    // overlay's registered elevation exactly (via the surface-context tracker) - the same treatment
    // as the token popup / menu.
    inject(AutoSurfaceDirective).matchOverlaySurface();

    // Color still has to be re-synced here instead of cascading through the detached DOM.
    effect(() => {
      const contextColorProvider = this.contextColorProvider;

      untracked(() => {
        if (contextColorProvider) {
          this.ownColorProvider.syncWithProvider(contextColorProvider);
        }
      });
    });
  }

  /** A tool button's accessible name, from the label set. */
  protected toolLabel(tool: RichTextEditorToolDefinition) {
    return richTextEditorToolLabel(this.labels(), tool);
  }
}
