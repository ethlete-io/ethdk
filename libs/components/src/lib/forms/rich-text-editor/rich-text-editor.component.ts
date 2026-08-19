import { DOCUMENT, NgComponentOutlet } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { injectHasTouchInput, injectRenderer } from '@ethlete/core';
import { EMPTY, fromEvent, interval, merge, switchMap, tap } from 'rxjs';
import { BUTTON_IMPORTS } from '../../button';
import { DividerComponent } from '../../divider';
import { ToolbarDirective } from '../../toolbar';
import {
  BOLD_ICON,
  CODE_BLOCK_ICON,
  CODE_ICON,
  IconDirective,
  ITALIC_ICON,
  LINK_ICON,
  LIST_BULLETED_ICON,
  LIST_NUMBERED_ICON,
  provideIcons,
  QUOTE_ICON,
  REDO_ICON,
  STRIKETHROUGH_ICON,
  UNDERLINE_ICON,
  UNDO_ICON,
} from '../../icon';
import { RichTextEditorDirective } from './headless';
import { RICH_TEXT_EDITOR_FLOATING_TOOLBAR } from './rich-text-editor-floating-toolbar.token';
import { richTextEditorToolLabel } from './rich-text-editor-labels';
import { RICH_TEXT_EDITOR_LINK_EDITOR } from './rich-text-editor-link-editor.token';
import { RICH_TEXT_EDITOR_TOOL, RICH_TEXT_EDITOR_TOOLS, RichTextEditorToolDefinition } from './rich-text-editor-tools';

/** How often the docked toolbar re-checks where the keyboard is, to recover a missed viewport event. */
const DOCKED_TOOLBAR_POLL_MS = 500;

/** Caret-navigation / deletion keys that should drop any pending stored-mark toggle. */
const NAVIGATION_KEYS = /* @__PURE__ */ new Set([
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
  imports: [...BUTTON_IMPORTS, DividerComponent, IconDirective, NgComponentOutlet, ToolbarDirective],
  providers: [
    provideIcons(
      BOLD_ICON,
      ITALIC_ICON,
      UNDERLINE_ICON,
      STRIKETHROUGH_ICON,
      CODE_ICON,
      LIST_BULLETED_ICON,
      LIST_NUMBERED_ICON,
      LINK_ICON,
      QUOTE_ICON,
      CODE_BLOCK_ICON,
      UNDO_ICON,
      REDO_ICON,
    ),
  ],
  hostDirectives: [
    {
      directive: RichTextEditorDirective,
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
        'placeholder',
        'tools',
        'autoformat',
        'labels',
      ],
      outputs: ['valueChange', 'touchedChange'],
    },
  ],
  host: {
    class: 'et-rich-text-editor',
    // on touch the toolbar is hidden until the editor is active, then docks above the keyboard (the
    // OS selection menu owns the top, so a top toolbar there is unreachable) - it never sits at the
    // top or shuffles around
    '[class.et-rich-text-editor--touch]': 'hasTouchInput()',
    '[class.et-rich-text-editor--docked-toolbar]': 'dockedToolbar()',
    '(click)': 'dir.activate()',
  },
})
export class RichTextEditorComponent {
  protected dir = inject(RichTextEditorDirective);

  private document = inject(DOCUMENT);
  private destroyRef = inject(DestroyRef);
  private renderer = injectRenderer();
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  /** Touch devices: menus open without stealing focus (keeps the keyboard up so the docked toolbar
   *  stays put) and the toolbar docks above the keyboard. */
  protected hasTouchInput = injectHasTouchInput();

  /** Present only when `provideRichTextEditorLinkEditor()` is in scope; otherwise the link tool
   *  falls back to `window.prompt` and the popover never ships. */
  private linkEditorSetup = inject(RICH_TEXT_EDITOR_LINK_EDITOR, { optional: true });
  /** Present only when `provideRichTextEditorFloatingToolbar()` is in scope; otherwise the editor
   *  shows its static toolbar only and the overlay runtime never ships. */
  private floatingToolbarSetup = inject(RICH_TEXT_EDITOR_FLOATING_TOOLBAR, { optional: true });
  public editable = viewChild.required<ElementRef<HTMLElement>>('editable');

  protected readonly TOOLS = RICH_TEXT_EDITOR_TOOLS;

  /** The strings in effect, owned by the directive so the opt-in tools read the same set. */
  protected labels = computed(() => this.dir.resolvedLabels());

  private registeredTools = inject(RICH_TEXT_EDITOR_TOOL, { optional: true }) ?? [];

  /** Keeps the docked toolbar up briefly after a blur so opening a menu/link editor from it (which
   *  moves focus into an overlay) doesn't collapse the bar mid-interaction. */
  private editingActive = signal(false);
  private blurGraceTimer: ReturnType<Window['setTimeout']> | null = null;

  /** Dock the toolbar above the keyboard only on touch while editing. */
  protected dockedToolbar = computed(() => this.hasTouchInput() && this.editingActive());

  constructor() {
    this.linkEditorSetup?.(this.dir, this.host.nativeElement);
    this.floatingToolbarSetup?.(this.dir);

    this.trackKeyboardInset();
    this.trackEditingActive();

    afterNextRender(() => {
      this.dir.editorDom.root.set(this.editable().nativeElement ?? null);
      this.dir.renderExternalValue();
    });

    fromEvent(this.document, 'selectionchange')
      .pipe(
        tap(() => {
          this.dir.refreshActiveMarks();
          this.dir.recordHistorySelection();
        }),
        takeUntilDestroyed(),
      )
      .subscribe();

    // Render programmatic (external) value changes into the DOM. Skip the user's own edits -
    // those already match `lastEmittedMarkdown`, so re-rendering would reset the caret.
    effect(() => {
      const markdown = this.dir.value();

      if (markdown === this.dir.lastEmittedMarkdown) return;

      this.dir.renderExternalValue(markdown);
    });
  }

  /** A tool button's accessible name, from the label set where this library owns the tool. */
  protected toolLabel(tool: RichTextEditorToolDefinition) {
    return richTextEditorToolLabel(this.labels(), tool);
  }

  protected syncValueFromDom() {
    this.dir.syncFromDom();
  }

  protected interceptEditorKeydown(event: KeyboardEvent) {
    // History first, and always prevented: the native contenteditable undo stack must never run,
    // since paste normalization and autoformat rewrite the DOM behind its back and it would restore
    // a state the value model never had. Ctrl/Cmd+Z undoes, Ctrl+Y and Ctrl/Cmd+Shift+Z redo.
    if ((event.ctrlKey || event.metaKey) && !event.altKey) {
      const key = event.key.toLowerCase();

      if (key === 'z' || key === 'y') {
        event.preventDefault();

        if (key === 'y' || event.shiftKey) this.dir.redo();
        else this.dir.undo();

        return;
      }
    }

    // moving the caret (or deleting) without typing abandons a pending stored-mark toggle
    if (NAVIGATION_KEYS.has(event.key)) {
      this.dir.clearPendingMarks();
    }

    // Tab / Shift+Tab nest / un-nest the current list item, or change a quote's nesting depth.
    // Outside both this falls through to the tool keydown hooks below (the table tool moves between
    // cells) and only then to the default focus move.
    if (event.key === 'Tab') {
      const blockquote = this.dir.editorDom.blockquote;
      const handled = event.shiftKey
        ? this.dir.editorDom.outdentListItem() || blockquote?.outdentBlockquote()
        : this.dir.editorDom.indentListItem() || blockquote?.indentBlockquote();

      if (handled) {
        event.preventDefault();
        this.dir.syncFromDom({ boundary: true });

        return;
      }
    }

    // Escape inside a code block moves the caret to a paragraph after it - everything typed in
    // there is literal, so there is no other way out with the keyboard alone.
    if (event.key === 'Escape' && this.dir.codeBlockActive() && this.dir.editorDom.codeBlock?.exitCodeBlock()) {
      event.preventDefault();
      this.dir.syncFromDom({ boundary: true });

      return;
    }

    // ArrowDown off the last line of a code block that ends the content - or ArrowUp off the first
    // line of one that starts it - creates the line it would move to: the exit people reach for
    // before they think of Escape, and at the top edge the only one there is.
    if (
      (event.key === 'ArrowDown' || event.key === 'ArrowUp') &&
      this.dir.codeBlockActive() &&
      this.dir.editorDom.codeBlock?.codeBlockArrowStep(event.key)
    ) {
      event.preventDefault();
      this.dir.syncFromDom({ boundary: true });

      return;
    }

    // Enter on an empty list item steps out of the list one level at a time; Enter at a heading's
    // edge starts a plain paragraph. Shift+Enter stays native (soft line break).
    if (event.key === 'Enter' && !event.shiftKey && this.dir.editorDom.handleEnter()) {
      event.preventDefault();
      this.dir.syncFromDom({ boundary: true });

      return;
    }

    // opt-in tools can intercept keys for content they own (e.g. the table tool steps the caret
    // cleanly across table boundaries instead of stranding it at the table's edge)
    for (const tool of this.registeredTools) {
      if (tool.keydown?.(this.dir, event)) {
        event.preventDefault();
        this.dir.syncFromDom({ boundary: true });

        return;
      }
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

  protected interceptPaste(event: ClipboardEvent) {
    // Tools own their payloads first: the image tool takes the clipboard's image files, which the
    // HTML/text branches below cannot represent.
    for (const tool of this.registeredTools) {
      if (tool.paste?.(this.dir, event)) {
        event.preventDefault();

        return;
      }
    }

    // Files nobody claimed: the browser would insert them itself, and for an image that means a
    // `blob:` URL in the value - one that dies with the tab. Provide the image tool to keep them.
    if (event.clipboardData?.files.length && !event.clipboardData.getData('text/html')) {
      event.preventDefault();

      return;
    }

    const html = event.clipboardData?.getData('text/html');

    if (html) {
      event.preventDefault();
      this.dir.pasteHtml(html);

      return;
    }

    // A plain-text paste is already schema-safe - the browser inserts it as text. The exception is
    // text spelling out a token (`#User Name`), which only the editor can turn back into a chip.
    const text = event.clipboardData?.getData('text/plain');

    if (text && this.dir.pasteText(text)) event.preventDefault();
  }

  /**
   * Dropped content, in the same order as a paste: a tool that owns the payload takes it (the image
   * tool uploads image files), and anything left that carries files is refused - dropping a file on a
   * `contenteditable` otherwise has the browser embed it as a `blob:` URL, which outlives nothing.
   */
  protected interceptDrop(event: DragEvent) {
    for (const tool of this.registeredTools) {
      if (tool.drop?.(this.dir, event)) {
        event.preventDefault();

        return;
      }
    }

    if (event.dataTransfer?.files.length) event.preventDefault();
  }

  /** Lets a tool act on the content it owns - clicking an image opens the image tool's popover. */
  protected interceptClick(event: MouseEvent) {
    for (const tool of this.registeredTools) {
      if (tool.click?.(this.dir, event)) return;
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
      case 'formatUnderline':
        event.preventDefault();
        this.dir.toggleUnderline();
        break;
      // The platform's own undo affordances - the macOS Edit menu, iOS shake-to-undo, the Android
      // keyboard's undo key - never produce a keydown, but do arrive here.
      case 'historyUndo':
        event.preventDefault();
        this.dir.undo();
        break;
      case 'historyRedo':
        event.preventDefault();
        this.dir.redo();
        break;
      case 'insertText':
        // markdown autoformat: a space may convert a line-start prefix (`- `, `1. `, `# `), a
        // delimiter may close an inline run (`**bold**`, `` `code` ``, …) into its mark
        if (event.data !== null && this.dir.handleAutoformat(event.data)) {
          event.preventDefault();
          break;
        }

        // apply any pending stored marks to the typed text (collapsed-caret formatting toggle)
        if (event.data !== null && this.dir.consumePendingInsert(event.data)) {
          event.preventDefault();
        }
        break;
    }
  }

  public focus(options?: FocusOptions) {
    this.dir.focus(options);
  }

  /** Track the visual viewport so the docked (fixed) toolbar sits right above the on-screen
   *  keyboard: the inset is the gap from where `position: fixed; bottom: 0` actually renders (a
   *  measured probe - see below) down past the keyboard's top edge
   *  (`visualViewport.offsetTop + height`). Reacting to BOTH `resize` and `scroll` keeps it glued
   *  while the page scrolls (the visual viewport pans, the URL bar shows/hides).
   *
   *  Performance: the CSS var is written straight to the host element, outside Angular - no signal,
   *  so no change detection fires per scroll frame (that was what made scrolling feel sluggish). The
   *  position has no CSS transition, so it tracks the viewport instantly instead of lagging behind. */
  private trackKeyboardInset() {
    const view = this.document.defaultView;
    const viewport = view?.visualViewport;

    if (!view || !viewport) return;

    const host = this.host.nativeElement;

    // In a same-origin iframe (Storybook, docs story embeds) the frame's own visualViewport never
    // reflects the soft keyboard - only the top window's does. Track the top viewport plus the
    // frame's position to compute how much of THIS frame the keyboard covers. A cross-origin
    // parent exposes neither (`frameElement` is null / viewport access throws), so those frames
    // keep the local metrics - the status quo of not seeing the keyboard at all.
    let frameElement: Element | null = null;
    let topViewport: VisualViewport | null = null;

    try {
      // no instanceof here - frameElement belongs to the PARENT document's realm, so it is never
      // an instance of this window's HTMLElement constructor
      frameElement = view.frameElement;
      topViewport = frameElement ? (view.top?.visualViewport ?? null) : null;
    } catch {
      frameElement = null;
      topViewport = null;
    }

    // Where "position: fixed; bottom: 0" actually lands is NOT derivable from window/visualViewport
    // on iOS: with the soft keyboard open (and focus zoom active), WebKit positions fixed elements
    // against an internal rect that tracks the visual viewport and is clamped to the document - its
    // bottom sits well below where `innerHeight` says. Measure it with a zero-size fixed probe
    // instead of assuming layout-viewport math; on engines without the quirk the probe bottom IS
    // `innerHeight`, so this degenerates to the plain `innerHeight - height - offsetTop`.
    const probe = this.renderer.createElement('div') as HTMLElement;
    this.renderer.setCssProperties(probe, {
      position: 'fixed',
      'inset-block-end': '0',
      'inline-size': '0',
      'block-size': '0',
      visibility: 'hidden',
    });
    this.renderer.appendChild(this.document.body, probe);
    this.destroyRef.onDestroy(() => probe.remove());

    let lastApplied = -1;

    const apply = () => {
      const fixedBottom = probe.getBoundingClientRect().bottom;
      let keyboardTop: number;

      if (frameElement && topViewport) {
        // keyboard overlap of this frame, in the frame's own client coordinates
        const covered = frameElement.getBoundingClientRect().bottom - (topViewport.offsetTop + topViewport.height);
        keyboardTop = view.innerHeight - Math.max(0, covered);
      } else {
        keyboardTop = viewport.offsetTop + viewport.height;
      }

      const inset = Math.max(0, fixedBottom - keyboardTop);

      if (inset === lastApplied) return false;

      lastApplied = inset;
      // set the CSS var directly via the renderer (not a signal) so scroll/resize don't schedule
      // change detection each frame - that per-frame CD was what made scrolling feel sluggish
      this.renderer.setCssProperty(host, '--_et-rte-keyboard-inset', `${inset}px`);

      return true;
    };

    // iOS moves its fixed-position rect ASYNCHRONOUSLY while scrolling with the keyboard open (and
    // fires few or no visualViewport events mid-scroll, including when the scroll itself dismisses
    // the keyboard) - a single synchronous re-measure per event reads a stale probe rect and the
    // toolbar drifts under the keyboard. So each event kicks a rAF loop that keeps re-measuring
    // until the inset has been stable for a few frames, then stops - continuous tracking while
    // anything moves, zero per-frame work at rest.
    let rafId: number | null = null;
    let quietFrames = 0;

    const settle = () => {
      quietFrames = apply() ? 0 : quietFrames + 1;
      // ~30 quiet frames (≈500ms) so the loop outlasts the keyboard show/hide animation - iOS can
      // fire its last viewport event right at the animation's start while the fixed-position rect
      // keeps moving until the end
      rafId = quietFrames < 30 ? view.requestAnimationFrame(settle) : null;
    };

    const kick = () => {
      quietFrames = 0;
      apply();
      rafId ??= view.requestAnimationFrame(settle);
    };

    kick();
    this.destroyRef.onDestroy(() => {
      if (rafId !== null) view.cancelAnimationFrame(rafId);
    });

    // The event stream is not guaranteed to be complete: a soft keyboard can change height without a
    // viewport event (Gboard switching layout, a suggestion row appearing), and inside an embedded
    // frame the event may land while the ancestor layout is still moving. Either leaves the bar parked
    // for a keyboard that is no longer there - floating over the content instead of sitting on it. So
    // re-measure on a slow timer for as long as the bar is actually docked: one rect read every
    // POLL_MS, no rAF loop and no change detection, and a stale position heals within half a second.
    toObservable(this.dockedToolbar)
      .pipe(
        switchMap((docked) => (docked ? interval(DOCKED_TOOLBAR_POLL_MS) : EMPTY)),
        tap(() => apply()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    const viewports = topViewport ? [viewport, topViewport] : [viewport];
    // window scroll too: a root scroll pans the keyboard-tracking fixed rect without necessarily
    // firing any visualViewport event (top window as well when embedded in an iframe)
    const scrollTargets: (Window | VisualViewport)[] = [...viewports, view];

    try {
      if (frameElement && view.top) scrollTargets.push(view.top);
    } catch {
      // cross-origin top - its scrolls are invisible to us; the frame keeps local tracking
    }

    merge(
      ...viewports.map((v) => fromEvent(v, 'resize')),
      // These are ancestor viewports/windows (visualViewport, iframe top), not a component-owned
      // scroll container - signalElementScrollState targets a known elementRef and doesn't apply.
      // eslint-disable-next-line ethlete/prefer-scroll-state
      ...scrollTargets.map((t) => fromEvent(t, 'scroll', { passive: true })),
    )
      .pipe(
        tap(() => kick()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  /** `editingActive` follows the editor's focus, but lingers ~400ms after a blur so a menu/link
   *  editor opened from the docked toolbar (which takes focus into an overlay) keeps the bar up. */
  private trackEditingActive() {
    effect(() => {
      // stay "active" while the editor is focused OR the link editor popover (part of the same
      // editing flow) is open - the popover borrows focus, but the toolbar should hold its place
      const active = this.dir.focused() || this.dir.linkEditorOpen();

      if (active) {
        if (this.blurGraceTimer !== null) this.document.defaultView?.clearTimeout(this.blurGraceTimer);
        this.blurGraceTimer = null;
        this.editingActive.set(true);

        return;
      }

      this.blurGraceTimer = this.document.defaultView?.setTimeout(() => this.editingActive.set(false), 400) ?? null;
    });

    this.destroyRef.onDestroy(() => {
      if (this.blurGraceTimer !== null) this.document.defaultView?.clearTimeout(this.blurGraceTimer);
    });
  }
}
