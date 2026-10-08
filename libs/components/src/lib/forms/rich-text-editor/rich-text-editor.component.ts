import { DOCUMENT, NgComponentOutlet } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { injectHasTouchInput, injectRenderer } from '@ethlete/core';
import { EMPTY, finalize, fromEvent, ignoreElements, interval, merge, Observable, switchMap, tap } from 'rxjs';
import { BUTTON_IMPORTS } from '../../button';
import { DividerComponent } from '../../divider';
import { ScrollbarComponent } from '../../scrollbar';
import { ToolbarDirective } from '../../toolbar';
import {
  BOLD_ICON,
  CODE_ICON,
  ICONS_TOKEN,
  IconDirective,
  ITALIC_ICON,
  LIST_BULLETED_ICON,
  LIST_NUMBERED_ICON,
  provideIcons,
  REDO_ICON,
  STRIKETHROUGH_ICON,
  UNDERLINE_ICON,
  UNDO_ICON,
} from '../../icon';
import { RichTextEditorDirective } from './headless';
import { mountRichTextContentStyles } from './rich-text-content-styles.component';
import { RICH_TEXT_EDITOR_FLOATING_TOOLBAR } from './rich-text-editor-floating-toolbar.token';
import { richTextEditorToolLabel } from './rich-text-editor-labels';
import { RICH_TEXT_EDITOR_LINK_EDITOR } from './rich-text-editor-link-editor.token';
import { RICH_TEXT_EDITOR_TOOLS, RichTextEditorToolDefinition } from './rich-text-editor-tools';
import { RICH_TEXT_EDITOR_TOOL_ICON } from './tools/rich-text-editor-tool-icons';
import { ACCESSIBLE_NAME_INPUTS } from '../form-field/headless';
import { FIELD_STATE_INPUTS } from '../form-field/headless/field-state-control.directive';

/** How often the docked toolbar re-checks where the keyboard is, to recover a missed viewport event. */
const DOCKED_TOOLBAR_POLL_MS = 500;

const RICH_TEXT_EDITOR_ICONS = [
  BOLD_ICON,
  ITALIC_ICON,
  UNDERLINE_ICON,
  STRIKETHROUGH_ICON,
  CODE_ICON,
  LIST_BULLETED_ICON,
  LIST_NUMBERED_ICON,
  UNDO_ICON,
  REDO_ICON,
];

const provideRichTextEditorIcons = () =>
  provideIcons(
    ...RICH_TEXT_EDITOR_ICONS,
    ...(inject(RICH_TEXT_EDITOR_TOOL_ICON, { optional: true }) ?? []),
  ).useFactory();

@Component({
  selector: 'et-rich-text-editor',
  templateUrl: './rich-text-editor.component.html',
  styleUrl: './rich-text-editor.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [
    ...BUTTON_IMPORTS,
    DividerComponent,
    IconDirective,
    NgComponentOutlet,
    ScrollbarComponent,
    ToolbarDirective,
  ],
  providers: [{ provide: ICONS_TOKEN, useFactory: provideRichTextEditorIcons }],
  hostDirectives: [
    {
      directive: RichTextEditorDirective,
      inputs: [
        'value',
        'touched',
        'disabled',
        'readonly',
        'invalid',
        'errors',
        'required',
        'name',
        'placeholder',
        'tools',
        'autoformat',
        'labels',
        ...ACCESSIBLE_NAME_INPUTS,
        ...FIELD_STATE_INPUTS,
      ],
      outputs: ['valueChange', 'touchedChange', 'touch'],
    },
  ],
  host: {
    class: 'et-rich-text-editor',
    '[class.et-rich-text-editor--touch]': 'hasTouchInput()',
    '[class.et-rich-text-editor--docked-toolbar]': 'dockedToolbar()',
    '(click)': 'dir.activate()',
  },
})
export class RichTextEditorComponent {
  protected dir = inject(RichTextEditorDirective);

  private document = inject(DOCUMENT);
  private destroyRef = inject(DestroyRef);
  private injector = inject(Injector);
  private renderer = injectRenderer();
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected hasTouchInput = injectHasTouchInput();

  private linkEditorSetup = inject(RICH_TEXT_EDITOR_LINK_EDITOR, { optional: true });
  private floatingToolbarSetup = inject(RICH_TEXT_EDITOR_FLOATING_TOOLBAR, { optional: true });

  public editable = viewChild.required<ElementRef<HTMLElement>>('editable');

  protected readonly TOOLS = RICH_TEXT_EDITOR_TOOLS;

  protected labels = computed(() => this.dir.resolvedLabels());

  private editingActive = signal(false);
  private blurGraceTimer: ReturnType<Window['setTimeout']> | null = null;

  protected dockedToolbar = computed(() => this.hasTouchInput() && this.editingActive());

  constructor() {
    mountRichTextContentStyles();
    this.linkEditorSetup?.(this.dir, this.host.nativeElement);
    this.floatingToolbarSetup?.(this.dir);

    this.trackKeyboardInset();
    this.trackEditingActive();

    afterNextRender(() => {
      this.dir.attachEditable(this.editable().nativeElement);
    });
  }

  /** A tool button's accessible name, from the label set where this library owns the tool. */
  protected toolLabel(tool: RichTextEditorToolDefinition) {
    return richTextEditorToolLabel(this.labels(), tool);
  }

  public focus(options?: FocusOptions) {
    this.dir.focus(options);
  }

  private trackKeyboardInset() {
    toObservable(this.hasTouchInput)
      .pipe(
        switchMap((touch) => (touch ? this.keyboardInset$() : EMPTY)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  /**
   * Keeps `--_et-rte-keyboard-inset` at the gap between where `position: fixed; bottom: 0` renders
   * and the top of the soft keyboard, so the docked toolbar sits on the keyboard. Written straight to
   * the host, not through a signal, so scrolling never schedules change detection.
   */
  private keyboardInset$() {
    return new Observable<never>((subscriber) => {
      const view = this.document.defaultView;
      const viewport = view?.visualViewport;

      if (!view || !viewport) return;

      return this.observeKeyboardInset(view, viewport).subscribe(subscriber);
    });
  }

  private observeKeyboardInset(view: Window, viewport: VisualViewport) {
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

    // The event stream is not guaranteed to be complete: a soft keyboard can change height without a
    // viewport event (Gboard switching layout, a suggestion row appearing), and inside an embedded
    // frame the event may land while the ancestor layout is still moving. Either leaves the bar parked
    // for a keyboard that is no longer there - floating over the content instead of sitting on it. So
    // re-measure on a slow timer for as long as the bar is actually docked: one rect read every
    // POLL_MS, no rAF loop and no change detection, and a stale position heals within half a second.
    const poll$ = toObservable(this.dockedToolbar, { injector: this.injector }).pipe(
      switchMap((docked) => (docked ? interval(DOCKED_TOOLBAR_POLL_MS) : EMPTY)),
      tap(() => apply()),
    );

    const viewports = topViewport ? [viewport, topViewport] : [viewport];
    // window scroll too: a root scroll pans the keyboard-tracking fixed rect without necessarily
    // firing any visualViewport event (top window as well when embedded in an iframe)
    const scrollTargets: (Window | VisualViewport)[] = [...viewports, view];

    try {
      if (frameElement && view.top) scrollTargets.push(view.top);
    } catch {
      // cross-origin top - its scrolls are invisible to us; the frame keeps local tracking
    }

    const viewportChange$ = merge(
      ...viewports.map((v) => fromEvent(v, 'resize')),
      // These are ancestor viewports/windows (visualViewport, iframe top), not a component-owned
      // scroll container - signalElementScrollState targets a known elementRef and doesn't apply.
      // eslint-disable-next-line ethlete/prefer-scroll-state
      ...scrollTargets.map((t) => fromEvent(t, 'scroll', { passive: true })),
    ).pipe(tap(() => kick()));

    return merge(poll$, viewportChange$).pipe(
      ignoreElements(),
      finalize(() => {
        if (rafId !== null) view.cancelAnimationFrame(rafId);
        probe.remove();
      }),
    );
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
