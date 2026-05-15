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
import { OverlayTemplateHostComponent, OverlayTemplateHostData } from '../overlay-template-host.component';
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

  mode = input<OverlayMode>('non-modal');
  role = input<OverlayRole | undefined>(undefined);
  open = model(false);
  disabled = input(false);
  disableClose = input(false);
  autoFocus = input<OverlayAutoFocusTarget | string | false | undefined>(undefined);
  restoreFocus = input(true);
  hasBackdrop = input<boolean | undefined>(undefined);
  closeOnEscape = input(true);
  closeOnOutsidePointer = input(true);
  hostClass = input<string | string[] | undefined>(undefined);
  backdropClass = input<string | string[] | undefined>(undefined);
  panelClass = input<string | string[] | undefined>(undefined);
  placement = input<Placement>('bottom');
  fallbackPlacements = input<Placement[] | undefined>(undefined);
  offset = input<OffsetOptions | null>(8);
  viewportPadding = input<Padding | null>(8);
  autoResize = input(false);
  shift = input(true);
  autoHide = input(false);
  autoCloseIfReferenceHidden = input(false);
  mirrorWidth = input(false);
  private overlayManager = injectOverlayManager();

  /** @internal */
  registeredAnchor = signal<OverlayAnchorDirective | null>(null);
  /** @internal */
  registeredSurface = signal<OverlaySurfaceDirective | null>(null);
  /** @internal */
  registeredTrigger = signal<OverlayTriggerDirective | null>(null);
  /** @internal */
  overlayRef = signal<OverlayRef<OverlayTemplateHostComponent, unknown> | null>(null);

  isMounted = computed(() => this.overlayRef() !== null);

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
          currentRef.close(undefined, true);
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

  show() {
    if (this.disabled()) {
      return;
    }

    if (!this.open()) {
      this.open.set(true);
    }
  }

  hide(result?: unknown) {
    this.overlayRef()?.close(result, true);

    if (this.open()) {
      this.open.set(false);
    }
  }

  toggle() {
    if (this.open()) {
      this.hide();

      return;
    }

    this.show();
  }

  /** @internal */
  unregisterTrigger(trigger: OverlayTriggerDirective) {
    if (this.registeredTrigger() === trigger) {
      this.registeredTrigger.set(null);
    }
  }

  /** @internal */
  unregisterAnchor(anchor: OverlayAnchorDirective) {
    if (this.registeredAnchor() === anchor) {
      this.registeredAnchor.set(null);
    }
  }

  /** @internal */
  unregisterSurface(surface: OverlaySurfaceDirective) {
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

    const data: OverlayTemplateHostData = {
      context: templateContext,
      template: surface.templateRef,
    };

    const origin = this.originElement();
    const isAnchored = this.mode() === 'non-modal' && origin !== null;
    const overlayRef = this.overlayManager.open<OverlayTemplateHostComponent, OverlayTemplateHostData>(
      OverlayTemplateHostComponent,
      {
        autoFocus: this.autoFocus(),
        backdropClass: this.backdropClass(),
        closeOnEscape: this.closeOnEscape(),
        closeOnOutsidePointer: this.closeOnOutsidePointer(),
        data,
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
      },
    );

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
