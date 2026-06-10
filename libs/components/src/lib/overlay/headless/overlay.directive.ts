import {
  DestroyRef,
  Directive,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RuntimeError } from '@ethlete/core';
import { OffsetOptions, Padding, Placement } from '@floating-ui/dom';
import { take, tap } from 'rxjs';
import { OverlayAutoFocusTarget, OverlayMode, OverlayRole } from '../overlay-config';
import { OVERLAY_ERROR_CODES } from '../overlay-errors';
import { injectOverlayManager } from '../overlay-manager';
import { OverlayRef } from '../overlay-ref';
import { OverlayTemplateHostComponent } from '../overlay-template-host.component';
import { OverlayAnchorDirective } from './overlay-anchor.directive';
import { OverlaySurfaceContext, OverlaySurfaceDirective } from './overlay-surface.directive';
import { OverlayTriggerDirective } from './overlay-trigger.directive';

@Directive({
  selector: '[etOverlay]',
  exportAs: 'etOverlay',
  host: {
    '[attr.data-overlay-open]': 'open() || null',
    '[attr.data-overlay-mode]': 'mode()',
  },
})
export class OverlayDirective {
  private destroyRef = inject(DestroyRef);

  public mode = input<OverlayMode>('non-modal');
  public role = input<OverlayRole | undefined>(undefined);
  public open = model(false);
  public disabled = input(false);
  public disableClose = input(false);
  public autoFocus = input<OverlayAutoFocusTarget | string | false | undefined>(undefined);
  public restoreFocus = input(true);
  public hasBackdrop = input<boolean | undefined>(undefined);
  public closeOnEscape = input(true);
  public closeOnOutsidePointer = input(true);
  public hostClass = input<string | string[] | undefined>(undefined);
  public backdropClass = input<string | string[] | undefined>(undefined);
  public panelClass = input<string | string[] | undefined>(undefined);
  public placement = input<Placement>('bottom');
  public fallbackPlacements = input<Placement[] | undefined>(undefined);
  public offset = input<OffsetOptions | null>(8);
  public viewportPadding = input<Padding | null>(8);
  public autoResize = input(false);
  public shift = input(true);
  public autoHide = input(false);
  public autoCloseIfReferenceHidden = input(false);
  public mirrorWidth = input(false);
  private overlayManager = injectOverlayManager();

  /** @internal */
  public registeredAnchor = signal<OverlayAnchorDirective | null>(null);
  /** @internal */
  public registeredSurface = signal<OverlaySurfaceDirective | null>(null);
  /** @internal */
  public registeredTrigger = signal<OverlayTriggerDirective | null>(null);
  /** @internal */
  public overlayRef = signal<OverlayRef<OverlayTemplateHostComponent, unknown> | null>(null);

  public isMounted = computed(() => this.overlayRef() !== null);

  private originElement = computed(() => {
    return (
      this.registeredAnchor()?.elementRef?.nativeElement ?? this.registeredTrigger()?.elementRef?.nativeElement ?? null
    );
  });

  constructor() {
    effect(() => {
      const disabled = this.disabled();
      const shouldBeOpen = this.open();
      const currentRef = this.overlayRef();

      if (disabled) {
        if (currentRef) {
          untracked(() => this.hide());
        }

        if (shouldBeOpen) {
          untracked(() => {
            this.open.set(false);
          });
        }

        return;
      }

      if (shouldBeOpen && !currentRef) {
        untracked(() => {
          this.mountOverlay();
        });

        return;
      }

      if (!shouldBeOpen && currentRef) {
        untracked(() => {
          currentRef.close();
        });
      }
    });

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.registeredSurface()) {
          throw new RuntimeError(
            OVERLAY_ERROR_CODES.MISSING_OVERLAY_SURFACE,
            '[OverlayDirective] Overlay surface not found. Add <ng-template etOverlaySurface> inside the [etOverlay] element.',
          );
        }
      });
    }
  }

  public show() {
    if (this.disabled()) {
      return;
    }

    if (!this.open()) {
      this.open.set(true);
    }
  }

  public hide(result?: unknown) {
    this.overlayRef()?.close(result);

    if (this.open()) {
      this.open.set(false);
    }
  }

  public toggle() {
    if (this.open()) {
      this.hide();

      return;
    }

    this.show();
  }

  /** @internal */
  public unregisterTrigger(trigger: OverlayTriggerDirective) {
    if (this.registeredTrigger() === trigger) {
      this.registeredTrigger.set(null);
    }
  }

  /** @internal */
  public unregisterAnchor(anchor: OverlayAnchorDirective) {
    if (this.registeredAnchor() === anchor) {
      this.registeredAnchor.set(null);
    }
  }

  /** @internal */
  public unregisterSurface(surface: OverlaySurfaceDirective) {
    if (this.registeredSurface() === surface) {
      this.registeredSurface.set(null);
    }
  }

  private mountOverlay() {
    const surface = this.registeredSurface();
    if (!surface) {
      return;
    }

    const templateContext: OverlaySurfaceContext = {
      $implicit: this,
      overlay: this,
      close: (result?: unknown) => this.hide(result),
    };

    const origin = this.originElement();
    const isAnchored = this.mode() === 'non-modal' && origin !== null;
    const overlayRef = this.overlayManager.open<OverlayTemplateHostComponent>(OverlayTemplateHostComponent, {
      autoFocus: this.autoFocus(),
      backdropClass: this.backdropClass(),
      closeOnEscape: this.closeOnEscape(),
      closeOnOutsidePointer: this.closeOnOutsidePointer(),
      inputBindings: {
        template: surface.templateRef,
        context: templateContext,
      },
      disableClose: this.disableClose(),
      hasBackdrop: this.hasBackdrop(),
      hostClass: this.hostClass(),
      mode: this.mode(),
      origin: isAnchored ? origin : undefined,
      panelClass: this.panelClass(),
      positionStrategy: isAnchored
        ? {
            kind: 'anchored',
            referenceElement: origin,
            placement: this.placement(),
            fallbackPlacements: this.fallbackPlacements(),
            offset: this.offset(),
            viewportPadding: this.viewportPadding(),
            autoResize: this.autoResize(),
            shift: this.shift(),
            autoHide: this.autoHide(),
            autoCloseIfReferenceHidden: this.autoCloseIfReferenceHidden(),
            mirrorWidth: this.mirrorWidth(),
          }
        : {
            kind: 'center',
          },
      restoreFocus: this.restoreFocus(),
      role: this.role(),
    });

    this.overlayRef.set(overlayRef);

    overlayRef
      .afterClosed()
      .pipe(
        take(1),
        takeUntilDestroyed(this.destroyRef),
        tap(() => {
          this.overlayRef.set(null);

          if (this.open()) {
            this.open.set(false);
          }
        }),
      )
      .subscribe();
  }
}
