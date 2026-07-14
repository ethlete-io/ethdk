import { DOCUMENT, NgComponentOutlet } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { markdownToHtml } from '@ethlete/core';
import { fromEvent, tap } from 'rxjs';
import { BUTTON_IMPORTS } from '../../button';
import {
  BOLD_ICON,
  CODE_ICON,
  HEADING_1_ICON,
  HEADING_2_ICON,
  HEADING_3_ICON,
  IconDirective,
  ITALIC_ICON,
  LINK_ICON,
  LIST_BULLETED_ICON,
  LIST_NUMBERED_ICON,
  PARAGRAPH_ICON,
  provideIcons,
  STRIKETHROUGH_ICON,
  UNDERLINE_ICON,
} from '../../icon';
import { MENU_IMPORTS } from '../../menu';
import { RichTextEditorDirective, RichTextEditorFloatingToolbarDirective } from './headless';
import {
  RICH_TEXT_EDITOR_HEADING_OPTIONS,
  RICH_TEXT_EDITOR_TOOL,
  RICH_TEXT_EDITOR_TOOL_BUTTONS,
  RICH_TEXT_EDITOR_TOOLS,
  RichTextEditorToolDefinition,
} from './rich-text-editor-tools';

/** Caret-navigation / deletion keys that should drop any pending stored-mark toggle. */
const NAVIGATION_KEYS = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'Escape',
  'Delete',
  'Backspace',
]);

@Component({
  selector: 'et-rich-text-editor',
  templateUrl: './rich-text-editor.component.html',
  styleUrl: './rich-text-editor.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [...BUTTON_IMPORTS, IconDirective, ...MENU_IMPORTS, NgComponentOutlet],
  providers: [
    provideIcons(
      BOLD_ICON,
      ITALIC_ICON,
      UNDERLINE_ICON,
      STRIKETHROUGH_ICON,
      CODE_ICON,
      HEADING_1_ICON,
      HEADING_2_ICON,
      HEADING_3_ICON,
      LIST_BULLETED_ICON,
      LIST_NUMBERED_ICON,
      LINK_ICON,
      PARAGRAPH_ICON,
    ),
  ],
  hostDirectives: [
    {
      directive: RichTextEditorDirective,
      inputs: [
        'value',
        'disabled',
        'readonly',
        'hidden',
        'invalid',
        'errors',
        'required',
        'name',
        'placeholder',
        'tools',
      ],
      outputs: ['valueChange', 'touchedChange'],
    },
    RichTextEditorFloatingToolbarDirective,
  ],
  host: {
    class: 'et-rich-text-editor',
    '(click)': 'dir.activate()',
  },
})
export class RichTextEditorComponent {
  protected dir = inject(RichTextEditorDirective);

  private document = inject(DOCUMENT);
  protected editable = viewChild.required<ElementRef<HTMLElement>>('editable');

  protected readonly TOOLS = RICH_TEXT_EDITOR_TOOLS;
  protected readonly HEADING_OPTIONS = RICH_TEXT_EDITOR_HEADING_OPTIONS;

  private registeredTools = inject(RICH_TEXT_EDITOR_TOOL, { optional: true }) ?? [];

  /** Every renderable tool by token: the static base buttons plus any opt-in tools provided via DI. */
  protected toolDefs = computed(() => {
    const defs = new Map<string, RichTextEditorToolDefinition>();

    for (const [token, button] of Object.entries(RICH_TEXT_EDITOR_TOOL_BUTTONS)) {
      if (button) defs.set(token, { token, ...button });
    }

    for (const def of this.registeredTools) defs.set(def.token, def);

    return defs;
  });

  /** The current block style option (used for the heading-menu trigger icon + label). */
  private currentHeading = computed(() =>
    this.HEADING_OPTIONS.find((option) => option.level === this.dir.headingLevel()),
  );

  protected currentHeadingLabel = computed(() => this.currentHeading()?.label ?? 'Normal');
  protected currentHeadingIcon = computed(() => this.currentHeading()?.icon ?? 'et-paragraph');

  constructor() {
    afterNextRender(() => {
      this.dir.editorDom.root.set(this.editable().nativeElement ?? null);
      this.renderExternalValue();
    });

    fromEvent(this.document, 'selectionchange')
      .pipe(
        tap(() => this.dir.refreshActiveMarks()),
        takeUntilDestroyed(),
      )
      .subscribe();

    // Render programmatic (external) value changes into the DOM. Skip the user's own edits -
    // those already match `lastEmittedMarkdown`, so re-rendering would reset the caret.
    effect(() => {
      const markdown = this.dir.value();

      if (markdown === this.dir.lastEmittedMarkdown) return;

      this.renderExternalValue(markdown);
    });
  }

  protected syncValueFromDom() {
    this.dir.syncFromDom();
  }

  protected selectHeading(level: unknown) {
    this.dir.setHeading(level as number | null);
    // the menu overlay pulled focus off the editor; hand it back (deferred so it wins over the
    // menu's own focus restoration on close) so the re-applied selection stays live in the editor.
    queueMicrotask(() => this.dir.activate());
  }

  protected interceptEditorKeydown(event: KeyboardEvent) {
    // moving the caret (or deleting) without typing abandons a pending stored-mark toggle
    if (NAVIGATION_KEYS.has(event.key)) {
      this.dir.clearPendingMarks();
    }

    // Tab / Shift+Tab nest / un-nest the current list item (falls through to default focus move
    // when the caret isn't in a list)
    if (event.key === 'Tab') {
      const handled = event.shiftKey ? this.dir.editorDom.outdentListItem() : this.dir.editorDom.indentListItem();

      if (handled) {
        event.preventDefault();
        this.dir.syncFromDom();
      }

      return;
    }

    // Enter on an empty list item steps out of the list one level at a time
    if (event.key === 'Enter' && this.dir.editorDom.handleEnter()) {
      event.preventDefault();
      this.dir.syncFromDom();

      return;
    }

    // step the caret cleanly across table boundaries instead of stranding it at the table's edge
    if (
      event.key.startsWith('Arrow') &&
      (this.dir.editorDom.tableExit(event.key) || this.dir.editorDom.tableEnter(event.key))
    ) {
      event.preventDefault();
      this.dir.syncFromDom();

      return;
    }

    // step out of an inline code span so the next typed text isn't code (caret move only, no edit)
    if (event.key.startsWith('Arrow') && this.dir.editorDom.codeExit(event.key)) {
      event.preventDefault();
      this.dir.refreshActiveMarks();

      return;
    }

    if (event.key === 'Backspace' && this.dir.handleBackspace()) {
      event.preventDefault();
    }
  }

  protected interceptFormattingCommand(event: InputEvent) {
    // Keep keyboard shortcuts (Ctrl/Cmd+B, …) running through our Selection/Range commands
    // instead of the browser's deprecated execCommand-backed formatting.
    switch (event.inputType) {
      case 'formatBold':
        event.preventDefault();
        this.dir.toggleBold();
        break;
      case 'formatItalic':
        event.preventDefault();
        this.dir.toggleItalic();
        break;
      case 'formatStrikeThrough':
        event.preventDefault();
        this.dir.toggleStrikethrough();
        break;
      case 'insertText':
        // apply any pending stored marks to the typed text (collapsed-caret formatting toggle)
        if (event.data !== null && this.dir.consumePendingInsert(event.data)) {
          event.preventDefault();
        }
        break;
    }
  }

  private renderExternalValue(markdown = this.dir.value()) {
    const el = this.editable()?.nativeElement;

    if (!el) return;

    const codec = this.dir.tokenCodec();
    const html = markdownToHtml(markdown);

    el.innerHTML = codec ? codec.render(html) : html;
    codec?.hydrate(el);
    this.dir.lastEmittedMarkdown = markdown;
  }
}
