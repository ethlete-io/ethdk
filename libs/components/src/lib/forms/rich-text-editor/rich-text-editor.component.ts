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
import { EMPTY, interval, switchMap } from 'rxjs';
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
import { observeKeyboardInset } from '../../internals/keyboard-inset';
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
   * Keeps `--_et-rte-keyboard-inset` at the soft keyboard's inset, so the docked toolbar sits on the
   * keyboard. Written straight to the host, not through a signal, so scrolling never schedules change
   * detection.
   */
  private keyboardInset$() {
    const view = this.document.defaultView;

    if (!view) return EMPTY;

    const host = this.host.nativeElement;

    return observeKeyboardInset({
      view,
      renderer: this.renderer,
      onInset: (inset) => this.renderer.setCssProperty(host, '--_et-rte-keyboard-inset', `${inset}px`),
      poll$: toObservable(this.dockedToolbar, { injector: this.injector }).pipe(
        switchMap((docked) => (docked ? interval(DOCKED_TOOLBAR_POLL_MS) : EMPTY)),
      ),
    });
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
