import { DOCUMENT, NgComponentOutlet } from '@angular/common';
import {
  afterEveryRender,
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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { injectHasTouchInput, injectRenderer, markdownToHtml } from '@ethlete/core';
import { fromEvent, merge, tap } from 'rxjs';
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
import {
  RichTextEditorDirective,
  RichTextEditorFloatingToolbarDirective,
  RichTextEditorLinkEditorDirective,
} from './headless';
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
        'autoformat',
      ],
      outputs: ['valueChange', 'touchedChange'],
    },
    RichTextEditorFloatingToolbarDirective,
    RichTextEditorLinkEditorDirective,
  ],
  host: {
    class: 'et-rich-text-editor',
    // on touch the toolbar is hidden until the editor is active, then docks above the keyboard (the
    // OS selection menu owns the top, so a top toolbar there is unreachable) — it never sits at the
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
  protected editable = viewChild.required<ElementRef<HTMLElement>>('editable');
  protected toolbar = viewChild.required<ElementRef<HTMLElement>>('toolbar');

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

  /** Keeps the docked toolbar up briefly after a blur so opening a menu/link editor from it (which
   *  moves focus into an overlay) doesn't collapse the bar mid-interaction. */
  private editingActive = signal(false);
  private blurGraceTimer: ReturnType<Window['setTimeout']> | null = null;

  /** Dock the toolbar above the keyboard only on touch while editing. */
  protected dockedToolbar = computed(() => this.hasTouchInput() && this.editingActive());

  /** The toolbar button currently holding the single roving tab stop (ARIA toolbar pattern). */
  private toolbarTabStop: HTMLButtonElement | null = null;

  constructor() {
    this.trackKeyboardInset();
    this.trackEditingActive();

    // keep the roving tab stop valid as tools are added/removed or become disabled
    afterEveryRender(() => this.updateToolbarTabStops());

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

  /**
   * The toolbar is a single tab stop (ARIA toolbar pattern): Tab enters on one button, the arrow
   * keys move focus between the buttons, and the next Tab leaves the toolbar. Menu surfaces render
   * into an overlay, so every `button` inside the toolbar element is a toolbar control — including
   * the custom tool controls (`ngComponentOutlet`), which template bindings couldn't reach.
   */
  protected handleToolbarKeydown(event: KeyboardEvent) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') {
      return;
    }

    const buttons = this.toolbarButtons().filter((button) => !button.disabled);

    if (!buttons.length) return;

    const currentIndex = buttons.indexOf(this.document.activeElement as HTMLButtonElement);
    let next: HTMLButtonElement | undefined;

    switch (event.key) {
      case 'ArrowLeft':
        next = buttons[currentIndex <= 0 ? buttons.length - 1 : currentIndex - 1];
        break;
      case 'ArrowRight':
        next = buttons[(currentIndex + 1) % buttons.length];
        break;
      case 'Home':
        next = buttons[0];
        break;
      case 'End':
        next = buttons[buttons.length - 1];
        break;
    }

    if (!next) return;

    event.preventDefault();
    next.focus();
  }

  /** The last focused button keeps the tab stop, so Shift+Tab back re-enters where the user left. */
  protected handleToolbarFocusIn(event: FocusEvent) {
    const target = event.target;

    if (!(target instanceof HTMLButtonElement) || target.disabled) return;

    this.toolbarTabStop = target;
    this.updateToolbarTabStops();
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

    // Tab / Shift+Tab nest / un-nest the current list item. Outside a list this falls through to
    // the tool keydown hooks below (the table tool moves between cells) and only then to the
    // default focus move.
    if (event.key === 'Tab') {
      const handled = event.shiftKey ? this.dir.editorDom.outdentListItem() : this.dir.editorDom.indentListItem();

      if (handled) {
        event.preventDefault();
        this.dir.syncFromDom();

        return;
      }
    }

    // Enter on an empty list item steps out of the list one level at a time; Enter at a heading's
    // edge starts a plain paragraph. Shift+Enter stays native (soft line break).
    if (event.key === 'Enter' && !event.shiftKey && this.dir.editorDom.handleEnter()) {
      event.preventDefault();
      this.dir.syncFromDom();

      return;
    }

    // opt-in tools can intercept keys for content they own (e.g. the table tool steps the caret
    // cleanly across table boundaries instead of stranding it at the table's edge)
    for (const tool of this.registeredTools) {
      if (tool.keydown?.(this.dir, event)) {
        event.preventDefault();
        this.dir.syncFromDom();

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
    const html = event.clipboardData?.getData('text/html');

    // a plain-text paste is already schema-safe — the browser inserts it as text
    if (!html) return;

    event.preventDefault();
    this.dir.pasteHtml(html);
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

  private toolbarButtons() {
    // eslint-disable-next-line ethlete/no-dom-query -- custom tool controls (ngComponentOutlet) own their button templates, so no directive token could reach them
    return Array.from(this.toolbar().nativeElement.querySelectorAll<HTMLButtonElement>('button'));
  }

  private updateToolbarTabStops() {
    const buttons = this.toolbarButtons();
    const enabled = buttons.filter((button) => !button.disabled);

    if (!this.toolbarTabStop || !enabled.includes(this.toolbarTabStop)) {
      this.toolbarTabStop = enabled[0] ?? null;
    }

    for (const button of buttons) {
      const tabIndex = button === this.toolbarTabStop ? 0 : -1;

      // written imperatively (not a binding) since custom tool controls own their button templates;
      // only touch the DOM when the value changed so the per-render pass stays free
      if (button.tabIndex !== tabIndex) button.tabIndex = tabIndex;
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

  /** Track the visual viewport so the docked (fixed) toolbar sits right above the on-screen
   *  keyboard: the inset is the gap from where `position: fixed; bottom: 0` actually renders (a
   *  measured probe — see below) down past the keyboard's top edge
   *  (`visualViewport.offsetTop + height`). Reacting to BOTH `resize` and `scroll` keeps it glued
   *  while the page scrolls (the visual viewport pans, the URL bar shows/hides).
   *
   *  Performance: the CSS var is written straight to the host element, outside Angular — no signal,
   *  so no change detection fires per scroll frame (that was what made scrolling feel sluggish). The
   *  position has no CSS transition, so it tracks the viewport instantly instead of lagging behind. */
  private trackKeyboardInset() {
    const view = this.document.defaultView;
    const viewport = view?.visualViewport;

    if (!view || !viewport) return;

    const host = this.host.nativeElement;

    // In a same-origin iframe (Storybook, docs story embeds) the frame's own visualViewport never
    // reflects the soft keyboard — only the top window's does. Track the top viewport plus the
    // frame's position to compute how much of THIS frame the keyboard covers. A cross-origin
    // parent exposes neither (`frameElement` is null / viewport access throws), so those frames
    // keep the local metrics — the status quo of not seeing the keyboard at all.
    let frameElement: Element | null = null;
    let topViewport: VisualViewport | null = null;

    try {
      // no instanceof here — frameElement belongs to the PARENT document's realm, so it is never
      // an instance of this window's HTMLElement constructor
      frameElement = view.frameElement;
      topViewport = frameElement ? (view.top?.visualViewport ?? null) : null;
    } catch {
      frameElement = null;
      topViewport = null;
    }

    // Where "position: fixed; bottom: 0" actually lands is NOT derivable from window/visualViewport
    // on iOS: with the soft keyboard open (and focus zoom active), WebKit positions fixed elements
    // against an internal rect that tracks the visual viewport and is clamped to the document — its
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
      // change detection each frame — that per-frame CD was what made scrolling feel sluggish
      this.renderer.setCssProperty(host, '--_et-rte-keyboard-inset', `${inset}px`);

      return true;
    };

    // iOS moves its fixed-position rect ASYNCHRONOUSLY while scrolling with the keyboard open (and
    // fires few or no visualViewport events mid-scroll, including when the scroll itself dismisses
    // the keyboard) — a single synchronous re-measure per event reads a stale probe rect and the
    // toolbar drifts under the keyboard. So each event kicks a rAF loop that keeps re-measuring
    // until the inset has been stable for a few frames, then stops — continuous tracking while
    // anything moves, zero per-frame work at rest.
    let rafId: number | null = null;
    let quietFrames = 0;

    const settle = () => {
      quietFrames = apply() ? 0 : quietFrames + 1;
      // ~30 quiet frames (≈500ms) so the loop outlasts the keyboard show/hide animation — iOS can
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

    const viewports = topViewport ? [viewport, topViewport] : [viewport];
    // window scroll too: a root scroll pans the keyboard-tracking fixed rect without necessarily
    // firing any visualViewport event (top window as well when embedded in an iframe)
    const scrollTargets: (Window | VisualViewport)[] = [...viewports, view];

    try {
      if (frameElement && view.top) scrollTargets.push(view.top);
    } catch {
      // cross-origin top — its scrolls are invisible to us; the frame keeps local tracking
    }

    merge(
      ...viewports.map((v) => fromEvent(v, 'resize')),
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
      // editing flow) is open — the popover borrows focus, but the toolbar should hold its place
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
