import { Directive, InjectionToken, OnDestroy, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AnimatedOverlayDirective } from '@ethlete/core';
import { combineLatest, tap } from 'rxjs';
import { OverlayRef } from '../../components/overlay/utils/overlay-ref';

export const OVERLAY_CLOSE_BLOCKER_TOKEN = new InjectionToken<OverlayCloseBlockerDirective>(
  'OVERLAY_CLOSE_BLOCKER_TOKEN',
);

let uniqueId = 0;

@Directive({
  selector: '[etOverlayCloseBlocker]',
  standalone: true,
  providers: [
    {
      provide: OVERLAY_CLOSE_BLOCKER_TOKEN,
      useExisting: OverlayCloseBlockerDirective,
    },
  ],
})
export class OverlayCloseBlockerDirective implements OnDestroy {
  private readonly _id = `et-overlay-close-blocker-${uniqueId++}`;
  private readonly _animatedOverlay = inject(AnimatedOverlayDirective, { optional: true });
  private readonly _nearestOverlayRef = inject(OverlayRef, { optional: true });

  constructor() {
    if (!this._animatedOverlay || !this._nearestOverlayRef) return;

    combineLatest([this._animatedOverlay.isMounted$, this._animatedOverlay.isHidden$])
      .pipe(
        takeUntilDestroyed(),
        tap(([mounted, hidden]) => {
          if (mounted && !hidden) {
            this._nearestOverlayRef?._addInternalBackdropCloseInitiator(this._id);
          } else {
            this._nearestOverlayRef?._removeInternalBackdropCloseInitiator(this._id);
          }
        }),
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    this._nearestOverlayRef?._removeInternalBackdropCloseInitiator(this._id);
  }
}
