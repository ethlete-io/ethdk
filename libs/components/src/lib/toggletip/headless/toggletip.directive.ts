import {
  DestroyRef,
  Directive,
  ElementRef,
  TemplateRef,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { COLOR_PROVIDER, RuntimeError, SURFACE_PROVIDER } from '@ethlete/core';
import { OffsetOptions, Padding, Placement } from '@floating-ui/dom';
import { tap } from 'rxjs';
import { OverlayRef } from '../../overlay';
import { injectOverlayManager } from '../../overlay/overlay-manager';
import { TOGGLETIP_ERROR_CODES } from '../toggletip-errors';
import { ToggletipComponent } from '../toggletip.component';
import { createToggletipId } from '../toggletip.utils';

export type ToggletipContent = string | TemplateRef<unknown>;

@Directive({
  selector: '[etToggletip]',
  exportAs: 'etToggletip',
  host: {
    '(click)': 'toggle()',
    '(keydown.escape)': 'hide()',
    '[attr.aria-controls]': 'controls()',
    '[attr.aria-expanded]': 'expanded()',
    '[attr.aria-haspopup]': 'popupRole()',
    '[attr.data-toggletip-open]': 'isOpen() || null',
  },
})
export class ToggletipDirective {
  private destroyRef = inject(DestroyRef);
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private colorProvider = inject(COLOR_PROVIDER, { optional: true });
  private surfaceProvider = inject(SURFACE_PROVIDER, { optional: true });

  public content = input<ToggletipContent | null>(null, { alias: 'etToggletip' });
  public ariaLabel = input<string | null>(null, { alias: 'etToggletipAriaLabel' });
  public ariaLabelledBy = input<string | null>(null, { alias: 'etToggletipAriaLabelledBy' });
  public placement = input<Placement>('top');
  public fallbackPlacements = input<Placement[] | undefined>(undefined);
  public offset = input<OffsetOptions | null>(10);
  public arrowPadding = input<Padding | null>(8);
  public viewportPadding = input<Padding | null>(8);
  public disabled = input(false, { alias: 'etToggletipDisabled' });
  public open = model(false, { alias: 'etToggletipOpen' });

  private overlayManager = injectOverlayManager();

  /** @internal */
  public overlayRef = signal<OverlayRef<ToggletipComponent, unknown> | null>(null);

  private toggletipId = createToggletipId();
  private contentId = `${this.toggletipId}-content`;
  private resolvedAriaLabel = computed(() => {
    if (this.ariaLabelledBy()) {
      return null;
    }

    const ariaLabel = this.ariaLabel();
    if (ariaLabel) {
      return ariaLabel;
    }

    const content = this.content();
    return typeof content === 'string' ? content : null;
  });
  private resolvedAriaDescribedBy = computed(() => {
    const content = this.content();

    if (content instanceof TemplateRef) {
      return this.contentId;
    }

    return this.ariaLabel() || this.ariaLabelledBy() ? this.contentId : null;
  });

  constructor() {
    effect(() => {
      const content = this.content();
      const disabled = this.disabled();

      if ((content === null || disabled) && this.open()) {
        untracked(() => {
          this.open.set(false);
        });
      }
    });

    effect(() => {
      const content = this.content();
      const disabled = this.disabled();
      const open = this.open();

      if (!open || disabled || content === null) {
        untracked(() => {
          this.closeOverlay();
        });

        return;
      }

      if (!this.overlayRef()) {
        untracked(() => {
          this.mountToggletip(content);
        });
      }
    });
  }

  public toggle() {
    if (this.disabled() || this.content() === null) {
      this.hide();

      return;
    }

    this.open.update((open) => !open);
  }

  public show() {
    if (this.disabled() || this.content() === null) {
      return;
    }

    this.open.set(true);
  }

  public hide() {
    this.open.set(false);
  }

  public isOpen() {
    return this.open();
  }

  public controls() {
    return this.open() ? this.toggletipId : null;
  }

  public expanded() {
    return this.content() && !this.disabled() ? this.open() : null;
  }

  public popupRole() {
    return this.content() && !this.disabled() ? 'dialog' : null;
  }

  private mountToggletip(content: ToggletipContent) {
    if (this.overlayRef()) {
      return;
    }

    if (content instanceof TemplateRef && !this.ariaLabel() && !this.ariaLabelledBy()) {
      if (ngDevMode) {
        throw new RuntimeError(
          TOGGLETIP_ERROR_CODES.TEMPLATE_TOGGLETIP_REQUIRES_LABEL,
          '[ToggletipDirective] Template toggletips require etToggletipAriaLabel or etToggletipAriaLabelledBy so the dialog has an accessible name.',
        );
      }

      this.open.set(false);

      return;
    }

    const hostElement = this.elementRef.nativeElement;
    const overlayRef = this.overlayManager.open<ToggletipComponent>(ToggletipComponent, {
      id: this.toggletipId,
      inputBindings: {
        toggletipId: this.toggletipId,
        contentId: this.contentId,
        content,
        colorProvider: this.colorProvider ?? null,
        surfaceProvider: this.surfaceProvider ?? null,
      },
      role: 'dialog',
      ariaLabel: this.resolvedAriaLabel(),
      ariaLabelledBy: this.ariaLabelledBy(),
      ariaDescribedBy: this.resolvedAriaDescribedBy(),
      disableClose: false,
      hasBackdrop: false,
      mode: 'non-modal',
      origin: hostElement,
      closeOnEscape: true,
      closeOnOutsidePointer: true,
      panelClass: 'et-toggletip-panel',
      positionStrategy: {
        kind: 'anchored',
        referenceElement: hostElement,
        placement: this.placement(),
        fallbackPlacements: this.fallbackPlacements(),
        offset: this.offset(),
        arrowPadding: this.arrowPadding(),
        viewportPadding: this.viewportPadding(),
        shift: true,
        autoHide: true,
        autoCloseIfReferenceHidden: true,
      },
      restoreFocus: true,
      autoFocus: 'first-tabbable',
    });

    this.overlayRef.set(overlayRef);

    overlayRef
      .afterClosed()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        tap(() => {
          if (this.overlayRef() === overlayRef) {
            this.overlayRef.set(null);
          }

          if (this.open()) {
            this.open.set(false);
          }
        }),
      )
      .subscribe();
  }

  private closeOverlay() {
    this.overlayRef()?.close();
  }
}
