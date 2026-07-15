import { DOCUMENT } from '@angular/common';
import {
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
import { createComponentId, injectRenderer, OverlayRuntimeAnchoredPosition, RuntimeError } from '@ethlete/core';
import { VirtualElement } from '@floating-ui/dom';
import { fromEvent, map, take, tap } from 'rxjs';
import { OverlayConfig } from '../../../overlay/overlay-config';
import { injectOverlayManager } from '../../../overlay/overlay-manager';
import { OverlayRef } from '../../../overlay/overlay-ref';
import { OverlayStrategy, OverlayStrategyBreakpoint } from '../../../overlay/strategies';
import { RICH_TEXT_EDITOR_ERROR_CODES } from '../rich-text-editor-errors';
import { RichTextEditorTokenPopupComponent } from '../rich-text-editor-token-popup.component';
import { RichTextEditorTrigger, RichTextEditorTriggerItem } from '../rich-text-editor-trigger';
import {
  createRichTextEditorTokenCodec,
  TOKEN_CHIP_ATTR,
  TOKEN_CHIP_CLASS,
  TOKEN_ID_ATTR,
  TOKEN_ID_RE,
  TOKEN_LABEL_CLASS,
  TOKEN_PREFIX_CLASS,
  TOKEN_TYPE_ATTR,
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

  public emptyLabel = input('No results');

  private readonly listboxId = createComponentId('et-rte-token-popup');

  private activeMatch = signal<RichTextEditorTriggerMatch | null>(null);
  private activeIndex = signal(0);
  private overlayRef = signal<OverlayRef<RichTextEditorTokenPopupComponent, unknown> | null>(null);

  private itemsState = toSignal(
    trackTriggerItems(
      toObservable(this.activeMatch).pipe(map((m) => (m ? { trigger: m.trigger, query: m.query } : null))),
    ),
    // Start in the loading state, not empty — otherwise the popup flashes "No results" for a frame
    // before `toObservable(activeMatch)` emits (its effect fires on the next tick).
    { initialValue: { items: [], loading: true, error: null } },
  );

  private errorText = computed(() => {
    const error = this.itemsState().error;

    if (!error) return null;

    return error instanceof Error ? error.message : String(error);
  });

  private isComposing = false;
  private listenersAttached = false;
  /** Position of a trigger char the user dismissed (Escape) — suppresses reopening for that run. */
  private dismissed: { node: Text; offset: number } | null = null;

  constructor() {
    if (!this.editor) {
      throw new RuntimeError(
        RICH_TEXT_EDITOR_ERROR_CODES.TRIGGERS_OUTSIDE_EDITOR,
        '[etRichTextEditorTriggers] must be placed on an element that also has [etRichTextEditor] (e.g. <et-rich-text-editor>).',
      );
    }

    const editor = this.editor;

    // Install the codec so token chips (de)serialize even before any picker interaction.
    editor.tokenCodec.set(createRichTextEditorTokenCodec(() => this.triggers()));

    // Reserve the trigger chars so markdown autoformat never converts what may start a token run
    // (e.g. a `#` trigger vs `# ` heading), and suspend autoformat while a popup run is active.
    effect(() => editor.autoformatReservedChars.set(this.triggers().map((trigger) => trigger.char)));
    effect(() => editor.autoformatSuppressed.set(this.activeMatch() !== null));

    if (ngDevMode) {
      effect(() => this.assertUniqueTriggers(this.triggers()));
    }

    // Attach DOM listeners once the contenteditable exists.
    effect(() => {
      const root = editor.editorDom.root();

      if (!root || this.listenersAttached) return;

      this.listenersAttached = true;
      this.attachListeners(root);
    });

    // Keep the active row within range as the item list changes.
    effect(() => {
      const length = this.itemsState().items.length;

      untracked(() => {
        if (this.activeIndex() > length - 1) this.activeIndex.set(Math.max(0, length - 1));
      });
    });

    // aria-activedescendant follows the active row while the popup is open.
    effect(() => {
      const root = editor.editorDom.root();
      const open = !!this.overlayRef();
      const index = this.activeIndex();

      if (!root) return;

      untracked(() => {
        if (open) {
          this.renderer.setAttribute(root, 'aria-activedescendant', `${this.listboxId}-option-${index}`);
        } else {
          this.renderer.removeAttribute(root, 'aria-activedescendant');
        }
      });
    });

    this.destroyRef.onDestroy(() => this.close());
  }

  private attachListeners(root: HTMLElement) {
    fromEvent(root, 'input')
      .pipe(
        tap(() => this.syncDetection()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    // capture phase so navigation keys win over the editor's own (bubble-phase) key handling
    fromEvent<KeyboardEvent>(root, 'keydown', { capture: true })
      .pipe(
        tap((event) => this.interceptPopupKeys(event)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    fromEvent(root, 'compositionstart')
      .pipe(
        tap(() => (this.isComposing = true)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    fromEvent(root, 'compositionend')
      .pipe(
        tap(() => {
          this.isComposing = false;
          this.syncDetection();
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    fromEvent(this.document, 'selectionchange')
      .pipe(
        tap(() => this.syncDetection()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
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

    // The char moved to a new spot → this is a fresh run, clear any prior dismissal.
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
    // Delete a token chip as a single unit when the caret sits right after it.
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
        // Dismiss but keep the literal text so the user can keep typing (e.g. an email address).
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

    if (!match || item.disabled || !this.editor) return;

    const { type } = match.trigger;

    if (ngDevMode) this.assertValidToken(type, item.id);

    // Select the trigger char + query so inserting the token replaces it.
    const range = this.document.createRange();

    range.setStart(match.textNode, match.charOffset);
    range.setEnd(match.textNode, Math.min(match.caretOffset, match.textNode.length));

    const selection = this.document.getSelection();

    selection?.removeAllRanges();
    selection?.addRange(range);

    this.editor.insertAtomicToken(this.buildChip(match.trigger, item));
    // Trailing space so the caret escapes the chip and the next word doesn't hug it. Must be a
    // no-break space: a plain space at the end of a line is CSS-collapsed and Chrome drops it from
    // the text node on the next keystroke. Serialization normalizes it back to a plain space.
    this.editor.editorDom.insertToken(this.renderer.createText('\u00a0'));
    this.editor.syncFromDom();

    this.activeMatch.set(null);
    this.close();
  }

  private buildChip(trigger: RichTextEditorTrigger, item: RichTextEditorTriggerItem): HTMLElement {
    const chip = this.renderer.createElement('span') as HTMLElement;

    this.renderer.addClass(chip, TOKEN_CHIP_CLASS);
    this.renderer.setAttribute(chip, TOKEN_CHIP_ATTR, '');
    this.renderer.setAttribute(chip, TOKEN_TYPE_ATTR, trigger.type);
    this.renderer.setAttribute(chip, TOKEN_ID_ATTR, item.id);
    this.renderer.setAttribute(chip, 'contenteditable', 'false');

    // keep the trigger char (e.g. `@`, `#`) visible ahead of the label, matching `buildChipHtml`
    if (trigger.char) {
      const prefixEl = this.renderer.createElement('span') as HTMLElement;

      this.renderer.addClass(prefixEl, TOKEN_PREFIX_CLASS);
      this.renderer.appendChild(prefixEl, this.renderer.createText(trigger.char));
      this.renderer.appendChild(chip, prefixEl);
    }

    const labelEl = this.renderer.createElement('span') as HTMLElement;

    this.renderer.addClass(labelEl, TOKEN_LABEL_CLASS);
    this.renderer.appendChild(labelEl, this.renderer.createText(item.label));
    this.renderer.appendChild(chip, labelEl);

    return chip;
  }

  private deletePrecedingChip() {
    if (!this.editor) return false;

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
    this.editor.syncFromDom();

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
        inputBinding('emptyLabel', () => this.emptyLabel()),
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
        takeUntilDestroyed(this.destroyRef),
        tap(() => {
          if (this.overlayRef() !== ref) return;

          this.overlayRef.set(null);
          this.setAriaExpanded(false);
          // Closed by an outside pointer while a match was still active — end the run cleanly.
          if (this.activeMatch()) this.dismiss();
        }),
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

    return {
      kind: 'anchored',
      referenceElement,
      placement: 'bottom-start',
      fallbackPlacements: ['top-start', 'bottom-end', 'top-end'],
      offset: 4,
      shift: { crossAxis: true },
      autoResize: true,
      autoCloseIfReferenceHidden: true,
    };
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

  private assertUniqueTriggers(triggers: readonly RichTextEditorTrigger[]) {
    const chars = new Set<string>();
    const types = new Set<string>();

    for (const trigger of triggers) {
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

  private assertValidToken(type: string, id: string) {
    if (!TOKEN_TYPE_RE.test(type)) {
      throw new RuntimeError(
        RICH_TEXT_EDITOR_ERROR_CODES.INVALID_TOKEN_TYPE,
        `[etRichTextEditorTriggers] invalid trigger type "${type}". Types must match ${TOKEN_TYPE_RE}.`,
      );
    }

    if (!TOKEN_ID_RE.test(id)) {
      throw new RuntimeError(
        RICH_TEXT_EDITOR_ERROR_CODES.INVALID_TOKEN_ID,
        `[etRichTextEditorTriggers] invalid item id "${id}" for type "${type}". Ids must match ${TOKEN_ID_RE} so the {{type:id}} token round-trips through Markdown.`,
      );
    }
  }
}
