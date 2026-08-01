import { DOCUMENT } from '@angular/common';
import { DestroyRef, Directive, effect, inject, inputBinding, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  anchoredOverlayPosition,
  createComponentId,
  enableAnchoredOverlayPositionExtras,
  injectHasTouchInput,
  injectRenderer,
  OverlayRuntimeAnchoredPosition,
} from '@ethlete/core';
import { VirtualElement } from '@floating-ui/dom';
import { take, tap } from 'rxjs';
import { OverlayConfig } from '../../../overlay/overlay-config';
import { injectOverlayManager } from '../../../overlay/overlay-manager';
import { OverlayRef } from '../../../overlay/overlay-ref';
import { OverlayStrategy, OverlayStrategyBreakpoint } from '../../../overlay/strategies';
import { RichTextEditorFloatingToolbarComponent } from '../rich-text-editor-floating-toolbar.component';
import { rangeTextBoundingRect } from './internals/rich-text-editor-dom';
import { RichTextEditorDirective } from './rich-text-editor.directive';

@Directive({
  selector: '[etRichTextEditorFloatingToolbar]',
})
export class RichTextEditorFloatingToolbarDirective {
  private editor = inject(RichTextEditorDirective);
  private document = inject(DOCUMENT);
  private renderer = injectRenderer();
  private overlayManager = injectOverlayManager();
  private destroyRef = inject(DestroyRef);
  /** On touch devices the platform shows its own selection menu (Copy/Paste/…) over the selection,
   *  which this toolbar would fight and hide behind; the always-visible static toolbar covers
   *  formatting there instead, so the floating toolbar is a pointer-device-only enhancement. */
  private hasTouchInput = injectHasTouchInput();

  private overlayId = createComponentId('et-rte-floating-toolbar');
  private overlayRef = signal<OverlayRef<RichTextEditorFloatingToolbarComponent, unknown> | null>(null);

  private activeRange: Range | null = null;
  private pointerSelectingInContent = false;

  constructor() {
    // close if the input modality flips to touch while the toolbar is open
    effect(() => {
      if (this.hasTouchInput()) this.hide();
    });

    effect((onCleanup) => {
      const root = this.editor.editorDom.root();

      if (!root) return;

      const listeners = [
        this.renderer.listen(root, 'pointerdown', () => (this.pointerSelectingInContent = true)),
        this.renderer.listen(root, 'keyup', () => this.evaluate()),
        this.renderer.listen(root, 'blur', () => this.hide()),
        this.renderer.listen(this.document, 'pointerup', () => this.finishContentPointerSelection()),
        this.renderer.listen(this.document, 'selectionchange', () => this.reposition()),
      ];

      onCleanup(() => listeners.forEach((off) => off()));
    });

    this.destroyRef.onDestroy(() => this.hide());
  }

  private selectableRange(): Range | null {
    if (this.hasTouchInput()) return null;

    const range = this.editor.editorDom.getSelection()?.range ?? null;
    const usable =
      !!range && !range.collapsed && this.editor.focused() && !this.editor.disabled() && !this.editor.readonly();

    return usable ? range : null;
  }

  private finishContentPointerSelection() {
    if (!this.pointerSelectingInContent) return;

    this.pointerSelectingInContent = false;
    this.evaluate();
  }

  /** Selection settled (key/pointer): open the toolbar or move it to the new range. */
  private evaluate() {
    const range = this.selectableRange();

    if (!range) {
      this.hide();

      return;
    }

    this.activeRange = range.cloneRange();
    this.openOrReposition();
  }

  /** Selection changed while open: follow it, or close if it is no longer usable. */
  private reposition() {
    const ref = this.overlayRef();

    if (!ref) return;

    const range = this.selectableRange();

    if (!range) {
      this.hide();

      return;
    }

    this.activeRange = range.cloneRange();
    ref.updatePositionStrategy(this.buildAnchoredPosition());
  }

  private openOrReposition() {
    const existing = this.overlayRef();

    if (existing) {
      existing.updatePositionStrategy(this.buildAnchoredPosition());

      return;
    }

    const strategy: OverlayStrategy = {
      id: this.overlayId,
      config: {
        containerClass: ['et-overlay--anchored', 'et-rte-floating-toolbar-overlay'],
        positionStrategy: () => this.buildAnchoredPosition(),
      },
    };

    const strategies = (): OverlayStrategyBreakpoint[] => [{ strategy }];

    const config: OverlayConfig = {
      mode: 'non-modal',
      hasBackdrop: false,
      // the toolbar formats the editor's selection, so it must never take focus away from it
      autoFocus: false,
      restoreFocus: false,
      closeOnEscape: false,
      // dismissal is driven by the selection itself (collapse / blur), not by outside pointers
      closeOnOutsidePointer: false,
      origin: this.editor.editorDom.root() ?? undefined,
      bindings: [inputBinding('editor', () => this.editor)],
      strategies,
    };

    const ref = this.overlayManager.open<RichTextEditorFloatingToolbarComponent>(
      RichTextEditorFloatingToolbarComponent,
      config,
    );

    this.overlayRef.set(ref);

    // the overlay can close itself (e.g. the selection scrolled out of view) - drop the stale ref
    // so the next usable selection opens a fresh one
    ref
      .afterClosed()
      .pipe(
        take(1),
        takeUntilDestroyed(this.destroyRef),
        tap(() => {
          if (this.overlayRef() === ref) this.overlayRef.set(null);
        }),
      )
      .subscribe();
  }

  private buildAnchoredPosition(): OverlayRuntimeAnchoredPosition {
    const referenceElement: VirtualElement = {
      getBoundingClientRect: () => (this.activeRange ? rangeTextBoundingRect(this.activeRange) : new DOMRect()),
      contextElement: this.editor.editorDom.root() ?? undefined,
    };

    enableAnchoredOverlayPositionExtras();

    return anchoredOverlayPosition({
      referenceElement,
      placement: 'top',
      fallbackPlacements: ['bottom'],
      offset: 8,
      // stay within the editor's content area so a selection near the top flips the toolbar below
      // the caret instead of covering the static toolbar above it
      boundary: this.editor.editorDom.root() ?? undefined,
      autoCloseIfReferenceHidden: true,
    });
  }

  private hide() {
    const ref = this.overlayRef();

    if (!ref) return;

    this.overlayRef.set(null);
    ref.close();
  }
}
