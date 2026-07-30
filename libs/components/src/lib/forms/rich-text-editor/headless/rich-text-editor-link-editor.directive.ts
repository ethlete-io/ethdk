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

@Directive({
  selector: '[etRichTextEditorLinkEditor]',
})
export class RichTextEditorLinkEditorDirective {
  private editor = inject(RichTextEditorDirective);
  private document = inject(DOCUMENT);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private overlayManager = injectOverlayManager();
  private destroyRef = inject(DestroyRef);

  private overlayRef = signal<OverlayRef<RichTextEditorLinkEditorComponent, unknown> | null>(null);

  /** The selection the popover edits — captured on open, restored before applying (the popover's
   *  inputs take focus, which would otherwise collapse the live selection). */
  private savedRange: Range | null = null;

  constructor() {
    this.editor.openLinkEditor.set(() => this.open());

    this.destroyRef.onDestroy(() => {
      this.editor.openLinkEditor.set(null);
      this.close();
    });
  }

  private open() {
    // clicking the link button while the popover is open toggles it shut
    if (this.overlayRef()) {
      this.close();

      return;
    }

    if (this.editor.disabled() || this.editor.readonly()) return;

    // a tap on the link button can move focus off the editor on touch; restore the selection so the
    // popover edits and re-links what was actually selected
    this.editor.editorDom.restoreSelection();

    const selection = this.editor.editorDom.getSelection();
    const info = this.editor.editorDom.readActiveLink();

    if (!selection || !info) return;

    this.savedRange = selection.range.cloneRange();

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
      origin: this.host.nativeElement,
      bindings: [
        inputBinding('href', () => info.href),
        inputBinding('text', () => info.text),
        inputBinding('newTab', () => info.newTab),
        inputBinding('exists', () => info.exists),
        inputBinding('labels', () => this.editor.resolvedLabels()),
        outputBinding<RichTextEditorLinkEditorValue>('saveLink', (value) => this.apply(value)),
        outputBinding<void>('removeLink', () => this.remove()),
        outputBinding<void>('dismiss', () => this.dismiss()),
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
              positionStrategy: () => this.buildAnchoredPosition(),
              applyTransformOrigin: false,
              minWidth: 'unset',
              hasBackdrop: false,
            }),
          },
        ];
      },
    };

    const ref = this.overlayManager.open<RichTextEditorLinkEditorComponent>(RichTextEditorLinkEditorComponent, config);

    this.overlayRef.set(ref);
    this.editor.linkEditorOpen.set(true);

    ref
      .afterClosedEvent()
      .pipe(
        take(1),
        takeUntilDestroyed(this.destroyRef),
        tap((event) => {
          this.editor.linkEditorOpen.set(false);

          if (this.overlayRef() === ref) this.overlayRef.set(null);

          // Escape is an explicit "back to the editor" — hand focus back (restoreFocus is off).
          // An outside-pointer close is aimed at something else; don't steal its focus.
          if (event.source === 'escape') {
            queueMicrotask(() => this.editor.activate());
          }
        }),
      )
      .subscribe();
  }

  private apply(value: RichTextEditorLinkEditorValue) {
    this.restoreSelection();
    this.editor.applyLink(value.href, { newTab: value.newTab, text: value.text });
    this.close();
    queueMicrotask(() => this.editor.activate());
  }

  private remove() {
    this.restoreSelection();
    this.editor.removeLink();
    this.close();
    queueMicrotask(() => this.editor.activate());
  }

  /** The popover's own close button — an explicit dismiss, so focus goes back to the editor. */
  private dismiss() {
    this.close();
    queueMicrotask(() => this.editor.activate());
  }

  private restoreSelection() {
    if (!this.savedRange) return;

    const selection = this.document.getSelection();

    if (!selection) return;

    selection.removeAllRanges();
    selection.addRange(this.savedRange);
  }

  private buildAnchoredPosition(): OverlayRuntimeAnchoredPosition {
    const referenceElement: VirtualElement = {
      getBoundingClientRect: () => (this.savedRange ? rangeTextBoundingRect(this.savedRange) : new DOMRect()),
      contextElement: this.editor.editorDom.root() ?? undefined,
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
  }

  private close() {
    const ref = this.overlayRef();

    if (!ref) return;

    this.overlayRef.set(null);
    ref.close();
  }
}
