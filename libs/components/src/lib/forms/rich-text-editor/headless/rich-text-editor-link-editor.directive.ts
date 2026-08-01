import { DOCUMENT } from '@angular/common';
import { DestroyRef, Directive, ElementRef, inject, inputBinding, outputBinding, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { OverlayRuntimeAnchoredPosition } from '@ethlete/core';
import { VirtualElement } from '@floating-ui/dom';
import { take, tap } from 'rxjs';
import { OverlayConfig } from '../../../overlay/overlay-config';
import { injectOverlayManager } from '../../../overlay/overlay-manager';
import { OverlayRef } from '../../../overlay/overlay-ref';
import { injectAnchoredDialogStrategy, injectTopSheetStrategy } from '../../../overlay/strategies';
import {
  RichTextEditorLinkEditorComponent,
  RichTextEditorLinkEditorValue,
} from '../rich-text-editor-link-editor.component';
import { rangeTextBoundingRect } from './internals/rich-text-editor-dom';
import { RichTextEditorDirective } from './rich-text-editor.directive';

/**
 * Registers the link editor popover on `editor`: the link tool opens it instead of falling back to
 * `window.prompt`, anchored to the selection (a top sheet below `md`). Must run in an injection
 * context tied to the editor's lifetime — `provideRichTextEditorLinkEditor()` and
 * `[etRichTextEditorLinkEditor]` are the two ways in.
 *
 * @internal
 */
export const setupRichTextEditorLinkEditor = (editor: RichTextEditorDirective, host: HTMLElement) => {
  const document = inject(DOCUMENT);
  const overlayManager = injectOverlayManager();
  const destroyRef = inject(DestroyRef);

  const overlayRef = signal<OverlayRef<RichTextEditorLinkEditorComponent, unknown> | null>(null);

  /** The selection the popover edits — captured on open, restored before applying (the popover's
   *  inputs take focus, which would otherwise collapse the live selection). */
  let savedRange: Range | null = null;

  const close = () => {
    const ref = overlayRef();

    if (!ref) return;

    overlayRef.set(null);
    ref.close();
  };

  const restoreSelection = () => {
    if (!savedRange) return;

    const selection = document.getSelection();

    if (!selection) return;

    selection.removeAllRanges();
    selection.addRange(savedRange);
  };

  const buildAnchoredPosition = (): OverlayRuntimeAnchoredPosition => {
    const referenceElement: VirtualElement = {
      getBoundingClientRect: () => (savedRange ? rangeTextBoundingRect(savedRange) : new DOMRect()),
      contextElement: editor.editorDom.root() ?? undefined,
    };

    return {
      kind: 'anchored',
      referenceElement,
      placement: 'bottom',
      fallbackPlacements: ['top'],
      offset: 10,
      arrowPadding: 16,
      autoCloseIfReferenceHidden: true,
    };
  };

  const apply = (value: RichTextEditorLinkEditorValue) => {
    restoreSelection();
    editor.applyLink(value.href, { newTab: value.newTab, text: value.text });
    close();
    queueMicrotask(() => editor.activate());
  };

  const remove = () => {
    restoreSelection();
    editor.removeLink();
    close();
    queueMicrotask(() => editor.activate());
  };

  /** The popover's own close button — an explicit dismiss, so focus goes back to the editor. */
  const dismiss = () => {
    close();
    queueMicrotask(() => editor.activate());
  };

  const open = () => {
    // clicking the link button while the popover is open toggles it shut
    if (overlayRef()) {
      close();

      return;
    }

    if (editor.disabled() || editor.readonly()) return;

    // a tap on the link button can move focus off the editor on touch; restore the selection so the
    // popover edits and re-links what was actually selected
    editor.editorDom.restoreSelection();

    const selection = editor.editorDom.getSelection();
    const info = editor.editorDom.readActiveLink();

    if (!selection || !info) return;

    savedRange = selection.range.cloneRange();

    const config: OverlayConfig = {
      mode: 'non-modal',
      // focus the URL field on open (the overlay does this at the right time and within the opening
      // tap's user-activation window, so the mobile keyboard opens); closing hands focus back to the
      // editor via activate()
      autoFocus: 'input[type="url"]',
      restoreFocus: false,
      closeOnEscape: true,
      closeOnOutsidePointer: true,
      // the whole editor (toolbar + content) is the origin, so clicking the link button that opened
      // the popover cleanly toggles it shut instead of closing-then-reopening
      origin: host,
      bindings: [
        inputBinding('href', () => info.href),
        inputBinding('text', () => info.text),
        inputBinding('newTab', () => info.newTab),
        inputBinding('exists', () => info.exists),
        inputBinding('labels', () => editor.resolvedLabels()),
        outputBinding<RichTextEditorLinkEditorValue>('saveLink', (value) => apply(value)),
        outputBinding<void>('removeLink', () => remove()),
        outputBinding<void>('dismiss', () => dismiss()),
      ],
      // Responsive: on phones (< md) an anchored popover would be cramped against the on-screen
      // keyboard and the native selection menu, so use a top sheet (pinned above the keyboard). On
      // wider screens keep the anchored popover with an arrow pointing at the selection.
      strategies: () => {
        const topSheet = injectTopSheetStrategy();
        const anchoredDialog = injectAnchoredDialogStrategy();

        return [
          {
            strategy: topSheet.build({ containerClass: 'et-rte-link-editor-overlay', hasBackdrop: true }),
          },
          {
            breakpoint: 'md',
            strategy: anchoredDialog.build({
              containerClass: 'et-rte-link-editor-overlay',
              positionStrategy: () => buildAnchoredPosition(),
              applyTransformOrigin: false,
              minWidth: 'unset',
              hasBackdrop: false,
            }),
          },
        ];
      },
    };

    const ref = overlayManager.open<RichTextEditorLinkEditorComponent>(RichTextEditorLinkEditorComponent, config);

    overlayRef.set(ref);
    editor.linkEditorOpen.set(true);

    ref
      .afterClosedEvent()
      .pipe(
        take(1),
        takeUntilDestroyed(destroyRef),
        tap((event) => {
          editor.linkEditorOpen.set(false);

          if (overlayRef() === ref) overlayRef.set(null);

          // Escape is an explicit "back to the editor" — hand focus back (restoreFocus is off).
          // An outside-pointer close is aimed at something else; don't steal its focus.
          if (event.source === 'escape') {
            queueMicrotask(() => editor.activate());
          }
        }),
      )
      .subscribe();
  };

  editor.openLinkEditor.set(() => open());

  destroyRef.onDestroy(() => {
    editor.openLinkEditor.set(null);
    close();
  });
};

/**
 * Adds the link editor popover to a headless `[etRichTextEditor]`. The default `et-rich-text-editor`
 * takes the same wiring through `provideRichTextEditorLinkEditor()`.
 */
@Directive({
  selector: '[etRichTextEditorLinkEditor]',
})
export class RichTextEditorLinkEditorDirective {
  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef);

    setupRichTextEditorLinkEditor(inject(RichTextEditorDirective), host.nativeElement);
  }
}
