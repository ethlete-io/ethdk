import {
  DOCUMENT,
  DestroyRef,
  Directive,
  ElementRef,
  TemplateRef,
  booleanAttribute,
  computed,
  effect,
  inject,
  input,
  inputBinding,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  COLOR_PROVIDER,
  RuntimeError,
  injectFocusVisibleTracker,
  injectRenderer,
  isOnHigherOverlayLayer,
  resolveOverlayLayer,
} from '@ethlete/core';
import { OffsetOptions, Padding, Placement } from '@floating-ui/dom';
import { filter, fromEvent, map, switchMap, takeUntil, tap, timer } from 'rxjs';
import { OverlayConfig, OverlayRef, anchoredOverlayStrategy } from '../../overlay';
import { injectOverlayManager } from '../../overlay/overlay-manager';
import { TOOLTIP_ERROR_CODES } from '../tooltip-errors';
import { TooltipComponent } from '../tooltip.component';
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
  private overlayManager = injectOverlayManager();
  private focusVisibleTracker = injectFocusVisibleTracker();
  private renderer = injectRenderer();

  public content = input<TooltipContent | null>(null, { alias: 'etTooltip' });
  public ariaDescription = input<string | null>(null, { alias: 'etTooltipAriaDescription' });
  public placement = input<Placement>('top');
  public fallbackPlacements = input<Placement[] | undefined>(undefined);
  public offset = input<OffsetOptions | null>(8);
  /**
   * How close the arrow may get to the panel's corners. Must clear the panel's border radius
   * (`--_et-tooltip-radius`, 16px) or the arrow's base rides into the rounded corner - which is what
   * happens on aligned placements (`bottom-end`, `left-start`, …) and whenever `shift` pushes a panel
   * off center near a viewport edge.
   */
  public arrowPadding = input<Padding | null>(20);
  public viewportPadding = input<Padding | null>(8);
  public showDelay = input(DEFAULT_TOOLTIP_DELAY);
  public disabled = input(false, { alias: 'etTooltipDisabled', transform: booleanAttribute });

  /** @internal */
  public overlayRef = signal<OverlayRef<TooltipComponent, unknown> | null>(null);

  private hasHover = signal(false);
  private hasFocus = signal(false);
  private descriptionId = createTooltipId('et-tooltip-description');
  private descriptionElement: HTMLElement | null = null;
  private appliedDescriptionId: string | null = null;

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

  public show() {
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
    const config: OverlayConfig = {
      id: tooltipId,
      bindings: [
        inputBinding('tooltipId', () => tooltipId),
        inputBinding('content', () => this.content() ?? content),
        inputBinding('colorProvider', () => this.colorProvider ?? null),
      ],
      disableClose: true,
      hasBackdrop: false,
      mode: 'non-modal',
      origin: hostElement,
      closeOnEscape: false,
      closeOnOutsidePointer: false,
      panelClass: 'et-tooltip-panel',
      strategies: anchoredOverlayStrategy({
        containerClass: 'et-overlay--tooltip',
        arrow: true,
        placement: this.placement(),
        fallbackPlacements: this.fallbackPlacements(),
        offset: this.offset(),
        arrowPadding: this.arrowPadding(),
        viewportPadding: this.viewportPadding(),
        shift: true,
        autoHide: true,
        autoCloseIfReferenceHidden: true,
      }),
      restoreFocus: false,
      autoFocus: false,
    };
    const overlayRef = this.overlayManager.open<TooltipComponent>(TooltipComponent, config);

    this.overlayRef.set(overlayRef);
    this.syncHostDescription(tooltipId);
    this.dismissOnOutsidePointer(overlayRef);

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

  public hide() {
    this.overlayRef()?.close();
  }

  private setupHoverBehavior() {
    const hostElement = this.elementRef.nativeElement;

    // Pointer events rather than mouse events so the `pointerType` is readable: mobile browsers
    // synthesize a mouse enter around a tap, which pops a hover affordance the user never asked for
    // and then leaves it hanging until they tap elsewhere. A pen genuinely hovers, so only touch is
    // excluded - touch input is what the toggletip is for.
    const leave$ = fromEvent<PointerEvent>(hostElement, 'pointerleave');

    fromEvent<PointerEvent>(hostElement, 'pointerenter')
      .pipe(
        filter((event) => event.pointerType !== 'touch'),
        tap(() => this.hasHover.set(true)),
        switchMap(() => timer(this.showDelay()).pipe(takeUntil(leave$.pipe(tap(() => this.hasHover.set(false)))))),
        takeUntilDestroyed(this.destroyRef),
        tap(() => {
          if (!this.hasHover()) {
            return;
          }

          this.show();
        }),
      )
      .subscribe();

    leave$
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

  /**
   * A tooltip can outlive the hover that opened it - a `pointercancel`, a scroll that moves the
   * trigger out from under the pointer, or a browser that synthesizes an enter with no matching
   * leave. A press anywhere else is unambiguous, so treat it as a dismissal.
   */
  private dismissOnOutsidePointer(overlayRef: OverlayRef<TooltipComponent, unknown>) {
    const hostElement = this.elementRef.nativeElement;

    fromEvent<PointerEvent>(this.document, 'pointerdown', { capture: true })
      .pipe(
        takeUntil(overlayRef.afterClosed()),
        takeUntilDestroyed(this.destroyRef),
        filter((event) => !(event.target instanceof Node) || !hostElement.contains(event.target)),
        filter((event) => !isOnHigherOverlayLayer(event.target, resolveOverlayLayer(hostElement))),
        tap(() => {
          this.hasHover.set(false);
          this.hasFocus.set(false);
          this.hide();
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
    const hostElement = this.elementRef.nativeElement;
    const rest = (hostElement.getAttribute('aria-describedby') ?? '')
      .split(/\s+/)
      .filter((id) => id && id !== this.appliedDescriptionId && id !== descriptionId);
    const next = descriptionId ? [...rest, descriptionId] : rest;

    this.appliedDescriptionId = descriptionId;

    if (next.length) {
      this.renderer.setAttribute(hostElement, 'aria-describedby', next.join(' '));
    } else {
      this.renderer.removeAttribute(hostElement, 'aria-describedby');
    }
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
