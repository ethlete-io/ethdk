import {
  DOCUMENT,
  DestroyRef,
  Directive,
  ElementRef,
  TemplateRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  COLOR_PROVIDER,
  RuntimeError,
  SURFACE_PROVIDER,
  injectFocusVisibleTracker,
  injectRenderer,
} from '@ethlete/core';
import { OffsetOptions, Padding, Placement } from '@floating-ui/dom';
import { filter, fromEvent, map, switchMap, takeUntil, tap, timer } from 'rxjs';
import { OverlayRef } from '../../overlay';
import { injectOverlayManager } from '../../overlay/overlay-manager';
import { TOOLTIP_ERROR_CODES } from '../tooltip-errors';
import { TooltipComponent, TooltipContentData } from '../tooltip.component';
import { createTooltipId } from '../tooltip.utils';

export type TooltipContent = string | TemplateRef<unknown>;

const DEFAULT_TOOLTIP_DELAY = 300;

@Directive({
  selector: '[etTooltip]',
  exportAs: 'etTooltip',
  host: {
    '(keydown.escape)': 'hide()',
  },
})
export class TooltipDirective {
  private document = inject(DOCUMENT);
  private destroyRef = inject(DestroyRef);
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private colorProvider = inject(COLOR_PROVIDER, { optional: true });
  private surfaceProvider = inject(SURFACE_PROVIDER, { optional: true });

  content = input<TooltipContent | null>(null, { alias: 'etTooltip' });
  ariaDescription = input<string | null>(null, { alias: 'etTooltipAriaDescription' });
  placement = input<Placement>('top');
  fallbackPlacements = input<Placement[] | undefined>(undefined);
  offset = input<OffsetOptions | null>(8);
  arrowPadding = input<Padding | null>(8);
  viewportPadding = input<Padding | null>(8);
  showDelay = input(DEFAULT_TOOLTIP_DELAY);
  disabled = input(false, { alias: 'etTooltipDisabled' });
  private overlayManager = injectOverlayManager();
  private focusVisibleTracker = injectFocusVisibleTracker();
  private renderer = injectRenderer();

  /** @internal */
  overlayRef = signal<OverlayRef<TooltipComponent, unknown> | null>(null);

  private hasHover = signal(false);
  private hasFocus = signal(false);
  private descriptionId = createTooltipId('et-tooltip-description');
  private descriptionElement: HTMLElement | null = null;

  private accessibleDescription = computed(() => {
    const ariaDescription = this.ariaDescription();

    if (ariaDescription) {
      return ariaDescription;
    }

    const content = this.content();
    return typeof content === 'string' ? content : null;
  });

  constructor() {
    this.setupHoverBehavior();
    this.setupFocusBehavior();

    effect(() => {
      const description = this.accessibleDescription();

      untracked(() => {
        this.syncDescriptionElement(description);

        if (!this.overlayRef()) {
          this.syncHostDescription(description ? this.descriptionId : null);
        }
      });
    });

    effect(() => {
      const content = this.content();
      const disabled = this.disabled();

      if ((content === null || disabled) && this.overlayRef()) {
        untracked(() => {
          this.hide();
        });
      }
    });

    this.destroyRef.onDestroy(() => {
      this.removeDescriptionElement();
      this.syncHostDescription(null);
    });
  }

  show() {
    if (this.disabled()) {
      return;
    }

    const content = this.content();
    if (content === null) {
      return;
    }

    const accessibleDescription = this.accessibleDescription();
    if (content instanceof TemplateRef && !accessibleDescription) {
      if (ngDevMode) {
        throw new RuntimeError(
          TOOLTIP_ERROR_CODES.TEMPLATE_TOOLTIP_REQUIRES_DESCRIPTION,
          '[TooltipDirective] Template tooltips require etTooltipAriaDescription so non-visual users get an equivalent description.',
        );
      }

      return;
    }

    if (this.overlayRef()) {
      return;
    }

    const tooltipId = createTooltipId();
    const hostElement = this.elementRef.nativeElement;
    const overlayRef = this.overlayManager.open<TooltipComponent, TooltipContentData>(TooltipComponent, {
      id: tooltipId,
      data: {
        id: tooltipId,
        content,
        colorProvider: this.colorProvider ?? null,
        surfaceProvider: this.surfaceProvider ?? null,
      },
      disableClose: true,
      hasBackdrop: false,
      mode: 'non-modal',
      origin: hostElement,
      closeOnEscape: false,
      closeOnOutsidePointer: false,
      panelClass: 'et-tooltip-panel',
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
      restoreFocus: false,
      autoFocus: false,
    });

    this.overlayRef.set(overlayRef);
    this.syncHostDescription(tooltipId);

    overlayRef
      .afterClosed()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        tap(() => {
          if (this.overlayRef() === overlayRef) {
            this.overlayRef.set(null);
          }

          this.syncHostDescription(this.accessibleDescription() ? this.descriptionId : null);
        }),
      )
      .subscribe();
  }

  hide() {
    this.overlayRef()?.close(undefined, true);
  }

  private setupHoverBehavior() {
    const hostElement = this.elementRef.nativeElement;

    fromEvent(hostElement, 'mouseenter')
      .pipe(
        tap(() => this.hasHover.set(true)),
        switchMap(() =>
          timer(this.showDelay()).pipe(
            takeUntil(fromEvent(hostElement, 'mouseleave').pipe(tap(() => this.hasHover.set(false)))),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
        tap(() => {
          if (!this.hasHover()) {
            return;
          }

          this.show();
        }),
      )
      .subscribe();

    fromEvent(hostElement, 'mouseleave')
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        tap(() => {
          this.hasHover.set(false);

          if (!this.hasFocus()) {
            this.hide();
          }
        }),
      )
      .subscribe();
  }

  private setupFocusBehavior() {
    const hostElement = this.elementRef.nativeElement;

    fromEvent(hostElement, 'focus')
      .pipe(
        map(() => this.focusVisibleTracker.isFocusVisible()),
        filter(Boolean),
        takeUntilDestroyed(this.destroyRef),
        tap(() => {
          this.hasFocus.set(true);
          this.show();
        }),
      )
      .subscribe();

    fromEvent(hostElement, 'blur')
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        tap(() => {
          this.hasFocus.set(false);

          if (!this.hasHover()) {
            this.hide();
          }
        }),
      )
      .subscribe();
  }

  private syncHostDescription(descriptionId: string | null) {
    this.renderer.setAttribute(this.elementRef.nativeElement, 'aria-describedby', descriptionId);
  }

  private syncDescriptionElement(description: string | null) {
    if (!description) {
      this.removeDescriptionElement();

      return;
    }

    if (!this.descriptionElement) {
      const descriptionElement = this.renderer.createElement('div');

      this.renderer.setAttribute(descriptionElement, 'id', this.descriptionId);
      this.renderer.setStyle(descriptionElement, {
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: '0',
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(1px, 1px, 1px, 1px)',
        clipPath: 'inset(50%)',
        whiteSpace: 'nowrap',
        border: '0',
      });

      this.renderer.appendChild(this.document.body, descriptionElement);
      this.descriptionElement = descriptionElement;
    }

    this.renderer.setTextContent(this.descriptionElement, description);
  }

  private removeDescriptionElement() {
    if (!this.descriptionElement) {
      return;
    }

    const parentNode = this.renderer.parentNode(this.descriptionElement);
    if (parentNode) {
      this.renderer.removeChild(parentNode, this.descriptionElement);
    }

    this.descriptionElement = null;
  }
}
