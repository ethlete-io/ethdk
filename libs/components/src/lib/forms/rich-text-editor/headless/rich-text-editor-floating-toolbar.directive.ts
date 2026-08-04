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

/**
 * Registers the toolbar that follows the selection on `editor`. Must run in an injection context tied
 * to the editor's lifetime - `provideRichTextEditorFloatingToolbar()` and
 * `[etRichTextEditorFloatingToolbar]` are the two ways in.
 *
 * @internal
 */
export const setupRichTextEditorFloatingToolbar = (editor: RichTextEditorDirective) => {
  const document = inject(DOCUMENT);
  const renderer = injectRenderer();
  const overlayManager = injectOverlayManager();
  const destroyRef = inject(DestroyRef);
  /** On touch devices the platform shows its own selection menu (Copy/Paste/…) over the selection,
   *  which this toolbar would fight and hide behind; the always-visible static toolbar covers
   *  formatting there instead, so the floating toolbar is a pointer-device-only enhancement. */
  const hasTouchInput = injectHasTouchInput();

  const overlayId = createComponentId('et-rte-floating-toolbar');
  const overlayRef = signal<OverlayRef<RichTextEditorFloatingToolbarComponent, unknown> | null>(null);

  let activeRange: Range | null = null;
  let pointerSelectingInContent = false;

  const hide = () => {
    const ref = overlayRef();

    if (!ref) return;

    overlayRef.set(null);
    ref.close();
  };

  const selectableRange = (): Range | null => {
    if (hasTouchInput()) return null;

    const range = editor.editorDom.getSelection()?.range ?? null;
    const usable = !!range && !range.collapsed && editor.focused() && !editor.disabled() && !editor.readonly();

    return usable ? range : null;
  };

  const buildAnchoredPosition = (): OverlayRuntimeAnchoredPosition => {
    const referenceElement: VirtualElement = {
      getBoundingClientRect: () => (activeRange ? rangeTextBoundingRect(activeRange) : new DOMRect()),
      contextElement: editor.editorDom.root() ?? undefined,
    };

    enableAnchoredOverlayPositionExtras();

    return anchoredOverlayPosition({
      referenceElement,
      placement: 'top',
      fallbackPlacements: ['bottom'],
      offset: 8,
      // stay within the editor's content area so a selection near the top flips the toolbar below
      // the caret instead of covering the static toolbar above it
      boundary: editor.editorDom.root() ?? undefined,
      autoCloseIfReferenceHidden: true,
    });
  };

  const openOrReposition = () => {
    const existing = overlayRef();

    if (existing) {
      existing.updatePositionStrategy(buildAnchoredPosition());

      return;
    }

    const strategy: OverlayStrategy = {
      id: overlayId,
      config: {
        containerClass: ['et-overlay--anchored', 'et-rte-floating-toolbar-overlay'],
        positionStrategy: () => buildAnchoredPosition(),
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
      origin: editor.editorDom.root() ?? undefined,
      bindings: [inputBinding('editor', () => editor)],
      strategies,
    };

    const ref = overlayManager.open<RichTextEditorFloatingToolbarComponent>(
      RichTextEditorFloatingToolbarComponent,
      config,
    );

    overlayRef.set(ref);

    // the overlay can close itself (e.g. the selection scrolled out of view) - drop the stale ref
    // so the next usable selection opens a fresh one
    ref
      .afterClosed()
      .pipe(
        take(1),
        takeUntilDestroyed(destroyRef),
        tap(() => {
          if (overlayRef() === ref) overlayRef.set(null);
        }),
      )
      .subscribe();
  };

  /** Selection settled (key/pointer): open the toolbar or move it to the new range. */
  const evaluate = () => {
    const range = selectableRange();

    if (!range) {
      hide();

      return;
    }

    activeRange = range.cloneRange();
    openOrReposition();
  };

  /** Selection changed while open: follow it, or close if it is no longer usable. */
  const reposition = () => {
    const ref = overlayRef();

    if (!ref) return;

    const range = selectableRange();

    if (!range) {
      hide();

      return;
    }

    activeRange = range.cloneRange();
    ref.updatePositionStrategy(buildAnchoredPosition());
  };

  const finishContentPointerSelection = () => {
    if (!pointerSelectingInContent) return;

    pointerSelectingInContent = false;
    evaluate();
  };

  // close if the input modality flips to touch while the toolbar is open
  effect(() => {
    if (hasTouchInput()) hide();
  });

  effect((onCleanup) => {
    const root = editor.editorDom.root();

    if (!root) return;

    const listeners = [
      renderer.listen(root, 'pointerdown', () => (pointerSelectingInContent = true)),
      renderer.listen(root, 'keyup', () => evaluate()),
      renderer.listen(root, 'blur', () => hide()),
      renderer.listen(document, 'pointerup', () => finishContentPointerSelection()),
      renderer.listen(document, 'selectionchange', () => reposition()),
    ];

    onCleanup(() => listeners.forEach((off) => off()));
  });

  destroyRef.onDestroy(() => hide());
};

/**
 * Adds the selection toolbar to a headless `[etRichTextEditor]`. The default `et-rich-text-editor`
 * takes the same wiring through `provideRichTextEditorFloatingToolbar()`.
 */
@Directive({
  selector: '[etRichTextEditorFloatingToolbar]',
})
export class RichTextEditorFloatingToolbarDirective {
  constructor() {
    setupRichTextEditorFloatingToolbar(inject(RichTextEditorDirective));
  }
}
