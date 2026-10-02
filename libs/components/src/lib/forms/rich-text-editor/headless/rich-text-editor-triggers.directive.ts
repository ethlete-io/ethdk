import { DOCUMENT } from '@angular/common';
import {
  booleanAttribute,
  computed,
  DestroyRef,
  Directive,
  effect,
  inject,
  input,
  inputBinding,
  outputBinding,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  anchoredOverlayPosition,
  createComponentId,
  enableAnchoredOverlayPositionExtras,
  injectRenderer,
  OverlayRuntimeAnchoredPosition,
  RuntimeError,
} from '@ethlete/core';
import { VirtualElement } from '@floating-ui/dom';
import { fromEvent, map, merge, take, tap } from 'rxjs';
import { OverlayConfig } from '../../../overlay/overlay-config';
import { injectOverlayManager } from '../../../overlay/overlay-manager';
import { OverlayRef } from '../../../overlay/overlay-ref';
import { OverlayStrategy, OverlayStrategyBreakpoint } from '../../../overlay/strategies';
import { RICH_TEXT_EDITOR_ERROR_CODES } from '../rich-text-editor-errors';
import { DEFAULT_RICH_TEXT_EDITOR_LABELS } from '../rich-text-editor-labels';
import { RichTextEditorTokenPopupComponent } from '../rich-text-editor-token-popup.component';
import { RichTextEditorTrigger, RichTextEditorTriggerItem } from '../rich-text-editor-trigger';
import {
  assertValidToken,
  buildChipElement,
  createRichTextEditorTokenCodec,
  TOKEN_CHIP_ATTR,
  TOKEN_TYPE_RE,
} from './internals/rich-text-editor-token';
import {
  resolveTriggerMatch,
  RichTextEditorTriggerMatch,
  triggerCharRect,
} from './internals/rich-text-editor-trigger-detection';
import { trackTriggerItems } from './internals/rich-text-editor-trigger-source';
import { RichTextEditorDirective } from './rich-text-editor.directive';

@Directive({
  selector: '[etRichTextEditorTriggers]',
})
export class RichTextEditorTriggersDirective {
  private editor = inject(RichTextEditorDirective, { optional: true });
  private document = inject(DOCUMENT);
  private renderer = injectRenderer();
  private overlayManager = injectOverlayManager();
  private destroyRef = inject(DestroyRef);

  public triggers = input<readonly RichTextEditorTrigger[]>([]);

  /**
   * Recognize tokens in pasted text that spell themselves out - `#User Name`, a trigger char plus an
   * item's label or id - and insert them as chips instead of literal text. Matches only against
   * triggers with a static `items` list. Turn it off to keep such text literal.
   *
   * @default true
   */
  public parsePastedTokens = input(true, { transform: booleanAttribute });

  /** Shown by the popup when a query matches nothing. `null` (the default) uses the editor's
   *  `noResults` label. */
  public emptyLabel = input<string | null>(null);

  private resolvedEmptyLabel = computed(
    () => this.emptyLabel() ?? this.editor?.resolvedLabels().noResults ?? DEFAULT_RICH_TEXT_EDITOR_LABELS.noResults,
  );

  private readonly listboxId = createComponentId('et-rte-token-popup');

  private activeMatch = signal<RichTextEditorTriggerMatch | null>(null);
  private activeIndex = signal(0);
  private overlayRef = signal<OverlayRef<RichTextEditorTokenPopupComponent, unknown> | null>(null);

  private itemsState = toSignal(
    trackTriggerItems(
      toObservable(this.activeMatch).pipe(map((m) => (m ? { trigger: m.trigger, query: m.query } : null))),
    ),
    // Start in the loading state, not empty - otherwise the popup flashes "No results" for a frame
    // before `toObservable(activeMatch)` emits (its effect fires on the next tick).
    { initialValue: { items: [], loading: true, error: null } },
  );

  private errorText = computed(() => {
    const error = this.itemsState().error;

    if (!error) return null;

    const message = error instanceof Error ? error.message : String(error);

    return message || (this.editor?.resolvedLabels().loadFailed ?? DEFAULT_RICH_TEXT_EDITOR_LABELS.loadFailed);
  });

  private isComposing = false;
  private dismissed: { node: Text; offset: number } | null = null;

  constructor() {
    if (!this.editor) {
      throw new RuntimeError(
        RICH_TEXT_EDITOR_ERROR_CODES.TRIGGERS_OUTSIDE_EDITOR,
        '[etRichTextEditorTriggers] must be placed on an element that also has [etRichTextEditor] (e.g. <et-rich-text-editor>).',
      );
    }

    const editor = this.editor;

    editor.tokenCodec.set(createRichTextEditorTokenCodec(() => this.triggers()));

    // Reserve the trigger chars so markdown autoformat never converts what may start a token run
    // (e.g. a `#` trigger vs `# ` heading), and suspend autoformat while a popup run is active.
    effect(() => {
      const reservedChars = this.triggers().map((trigger) => trigger.char);

      untracked(() => editor.autoformatReservedChars.set(reservedChars));
    });
    effect(() => {
      const suppressed = this.activeMatch() !== null;

      untracked(() => editor.autoformatSuppressed.set(suppressed));
    });
    effect(() => {
      const parse = this.parsePastedTokens();

      untracked(() => editor.parsePastedTokens.set(parse));
    });

    if (ngDevMode) {
      effect(() => this.assertValidTriggers(this.triggers()));
    }

    effect((onCleanup) => {
      const root = editor.editorDom.root();

      if (!root) return;

      const subscription = untracked(() => this.attachListeners(root));

      onCleanup(() => subscription.unsubscribe());
    });

    effect(() => {
      const length = this.itemsState().items.length;

      untracked(() => {
        if (this.activeIndex() > length - 1) this.activeIndex.set(Math.max(0, length - 1));
      });
    });

    effect(() => {
      const root = editor.editorDom.root();
      const listsOption = !!this.overlayRef() && this.itemsState().items.length > 0;
      const index = this.activeIndex();

      if (!root) return;

      untracked(() => {
        if (listsOption) {
          this.renderer.setAttribute(root, 'aria-activedescendant', `${this.listboxId}-option-${index}`);
        } else {
          this.renderer.removeAttribute(root, 'aria-activedescendant');
        }
      });
    });

    this.destroyRef.onDestroy(() => this.close());
  }

  private attachListeners(root: HTMLElement) {
    return merge(
      fromEvent(root, 'input').pipe(tap(() => this.syncDetection())),
      // capture phase so navigation keys win over the editor's own (bubble-phase) key handling
      fromEvent<KeyboardEvent>(root, 'keydown', { capture: true }).pipe(tap((event) => this.interceptPopupKeys(event))),
      fromEvent(root, 'compositionstart').pipe(tap(() => (this.isComposing = true))),
      fromEvent(root, 'compositionend').pipe(
        tap(() => {
          this.isComposing = false;
          this.syncDetection();
        }),
      ),
      fromEvent(this.document, 'selectionchange').pipe(tap(() => this.syncDetection())),
    ).subscribe();
  }

  private syncDetection() {
    if (this.isComposing || !this.editor) return;

    const root = this.editor.editorDom.root();
    const selection = root ? this.editor.editorDom.getSelection() : null;
    const match =
      root && selection ? resolveTriggerMatch({ triggers: this.triggers(), root, range: selection.range }) : null;

    if (!match || this.isDismissed(match)) {
      this.activeMatch.set(null);
      this.close();

      return;
    }

    if (this.dismissed && (this.dismissed.node !== match.textNode || this.dismissed.offset !== match.charOffset)) {
      this.dismissed = null;
    }

    const previous = this.activeMatch();

    this.activeMatch.set(match);

    if (!previous || previous.textNode !== match.textNode || previous.charOffset !== match.charOffset) {
      this.activeIndex.set(0);
    }

    this.openOrReposition();
  }

  private interceptPopupKeys(event: KeyboardEvent) {
    if (event.key === 'Backspace' && this.deletePrecedingChip()) {
      event.preventDefault();
      event.stopPropagation();

      return;
    }

    if (!this.overlayRef() || !this.activeMatch()) return;

    const hasItems = this.itemsState().items.length > 0;

    switch (event.key) {
      case 'ArrowDown':
        if (!hasItems) return;
        event.preventDefault();
        event.stopPropagation();
        this.moveActive(1);
        break;
      case 'ArrowUp':
        if (!hasItems) return;
        event.preventDefault();
        event.stopPropagation();
        this.moveActive(-1);
        break;
      case 'Enter':
      case 'Tab':
        if (!hasItems) return;
        event.preventDefault();
        event.stopPropagation();
        this.selectActive();
        break;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        this.dismiss();
        break;
    }
  }

  private moveActive(delta: number) {
    const length = this.itemsState().items.length;

    if (length === 0) return;

    this.activeIndex.set((this.activeIndex() + delta + length) % length);
  }

  private selectActive() {
    const items = this.itemsState().items;
    const item = items[Math.min(this.activeIndex(), items.length - 1)];

    if (item) this.insertItem(item);
  }

  private insertItem(item: RichTextEditorTriggerItem) {
    const match = this.activeMatch();

    if (!match || item.disabled || !this.editor || this.editor.disabled() || this.editor.readonly()) return;

    const { type } = match.trigger;

    if (ngDevMode) assertValidToken(type, item.id);

    const range = this.document.createRange();

    range.setStart(match.textNode, match.charOffset);
    range.setEnd(match.textNode, Math.min(match.caretOffset, match.textNode.length));

    const selection = this.document.getSelection();

    selection?.removeAllRanges();
    selection?.addRange(range);

    this.editor.editorDom.insertToken(this.buildChip(match.trigger, item));
    this.editor.editorDom.insertToken(this.renderer.createText('\u00a0'));
    this.editor.syncFromDom({ boundary: true });

    this.activeMatch.set(null);
    this.close();
  }

  private buildChip(trigger: RichTextEditorTrigger, item: RichTextEditorTriggerItem): HTMLElement {
    return buildChipElement(this.renderer, {
      type: trigger.type,
      id: item.id,
      label: item.label,
      prefix: trigger.char,
    });
  }

  private deletePrecedingChip() {
    if (!this.editor || this.editor.disabled() || this.editor.readonly()) return false;

    const selection = this.editor.editorDom.getSelection();

    if (!selection || !selection.range.collapsed) return false;

    const { range } = selection;
    const container = range.startContainer;
    let candidate: Node | null;

    if (container.nodeType === Node.TEXT_NODE) {
      if (range.startOffset !== 0) return false;
      candidate = container.previousSibling;
    } else {
      candidate = container.childNodes[range.startOffset - 1] ?? null;
    }

    if (!(candidate instanceof HTMLElement) || !candidate.hasAttribute(TOKEN_CHIP_ATTR)) return false;

    candidate.remove();
    this.editor.syncFromDom({ boundary: true });

    return true;
  }

  private dismiss() {
    const match = this.activeMatch();

    if (match) this.dismissed = { node: match.textNode, offset: match.charOffset };

    this.activeMatch.set(null);
    this.close();
  }

  private isDismissed(match: RichTextEditorTriggerMatch) {
    return !!this.dismissed && this.dismissed.node === match.textNode && this.dismissed.offset === match.charOffset;
  }

  private openOrReposition() {
    const existing = this.overlayRef();

    if (existing) {
      existing.updatePositionStrategy(this.buildAnchoredPosition());

      return;
    }

    const strategy: OverlayStrategy = {
      id: this.listboxId,
      config: {
        containerClass: ['et-overlay--anchored', 'et-rte-token-popup-overlay'],
        positionStrategy: () => this.buildAnchoredPosition(),
      },
    };

    const strategies = (): OverlayStrategyBreakpoint[] => [{ strategy }];

    const config: OverlayConfig = {
      mode: 'non-modal',
      hasBackdrop: false,
      autoFocus: false,
      restoreFocus: false,
      closeOnEscape: false,
      closeOnOutsidePointer: true,
      origin: this.editor?.editorDom.root() ?? undefined,
      bindings: [
        inputBinding('items', () => this.itemsState().items),
        inputBinding('activeIndex', () => this.activeIndex()),
        inputBinding('loading', () => this.itemsState().loading),
        inputBinding('error', () => this.errorText()),
        inputBinding('emptyLabel', () => this.resolvedEmptyLabel()),
        inputBinding('listboxId', () => this.listboxId),
        outputBinding<RichTextEditorTriggerItem>('selectItem', (item) => this.insertItem(item)),
        outputBinding<number>('activateItem', (index) => this.activeIndex.set(index)),
      ],
      strategies,
    };

    const ref = this.overlayManager.open<RichTextEditorTokenPopupComponent>(RichTextEditorTokenPopupComponent, config);

    this.overlayRef.set(ref);
    this.setAriaExpanded(true);

    ref
      .afterClosed()
      .pipe(
        take(1),
        tap(() => {
          if (this.overlayRef() !== ref) return;

          this.overlayRef.set(null);
          this.setAriaExpanded(false);
          if (this.activeMatch()) this.dismiss();
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private close() {
    const ref = this.overlayRef();

    if (!ref) return;

    this.overlayRef.set(null);
    this.setAriaExpanded(false);
    ref.close();
  }

  private buildAnchoredPosition(): OverlayRuntimeAnchoredPosition {
    const referenceElement: VirtualElement = {
      getBoundingClientRect: () => {
        const match = this.activeMatch();

        return match ? triggerCharRect(this.document, match) : new DOMRect();
      },
      contextElement: this.editor?.editorDom.root() ?? undefined,
    };

    enableAnchoredOverlayPositionExtras();

    return anchoredOverlayPosition({
      referenceElement,
      placement: 'bottom-start',
      fallbackPlacements: ['top-start', 'bottom-end', 'top-end'],
      offset: 4,
      shift: { crossAxis: true },
      autoResize: true,
      autoCloseIfReferenceHidden: true,
    });
  }

  private setAriaExpanded(open: boolean) {
    const root = this.editor?.editorDom.root();

    if (!root) return;

    this.renderer.setAttribute(root, 'aria-expanded', String(open));

    if (open) {
      this.renderer.setAttribute(root, 'aria-controls', this.listboxId);
      this.renderer.setAttribute(root, 'aria-haspopup', 'listbox');
    }
  }

  private assertValidTriggers(triggers: readonly RichTextEditorTrigger[]) {
    const chars = new Set<string>();
    const types = new Set<string>();

    for (const trigger of triggers) {
      if (trigger.char.length !== 1) {
        throw new RuntimeError(
          RICH_TEXT_EDITOR_ERROR_CODES.INVALID_TRIGGER_CHAR,
          `[etRichTextEditorTriggers] trigger char "${trigger.char}" must be exactly one character.`,
        );
      }

      if (!TOKEN_TYPE_RE.test(trigger.type)) {
        throw new RuntimeError(
          RICH_TEXT_EDITOR_ERROR_CODES.INVALID_TOKEN_TYPE,
          `[etRichTextEditorTriggers] invalid trigger type "${trigger.type}". Types must match ${TOKEN_TYPE_RE}.`,
        );
      }

      if (chars.has(trigger.char)) {
        throw new RuntimeError(
          RICH_TEXT_EDITOR_ERROR_CODES.DUPLICATE_TRIGGER_CHAR,
          `[etRichTextEditorTriggers] duplicate trigger char "${trigger.char}". Each trigger needs a unique char.`,
        );
      }

      if (types.has(trigger.type)) {
        throw new RuntimeError(
          RICH_TEXT_EDITOR_ERROR_CODES.DUPLICATE_TRIGGER_TYPE,
          `[etRichTextEditorTriggers] duplicate trigger type "${trigger.type}". Each trigger needs a unique type.`,
        );
      }

      chars.add(trigger.char);
      types.add(trigger.type);
    }
  }
}
