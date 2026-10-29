import { CdkDialogContainer } from '@angular/cdk/dialog';
import { OverlayRef } from '@angular/cdk/overlay';
import { ChangeDetectionStrategy, Component, ElementRef, inject } from '@angular/core';
import { ANIMATED_LIFECYCLE_TOKEN } from '@ethlete/core';
import { BottomSheetConfig } from '../../types';

/**
 * @deprecated Will be removed in v5.
 */
@Component({
  selector: 'et-bottom-sheet-container-base',
  changeDetection: ChangeDetectionStrategy.Eager,
  template: '',
})
export abstract class BottomSheetContainerBaseComponent extends CdkDialogContainer<BottomSheetConfig> {
  readonly _animatedLifecycle = inject(ANIMATED_LIFECYCLE_TOKEN);

  elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  overlayRef = inject(OverlayRef);

  protected override _captureInitialFocus(): void {
    if (!this._config.delayFocusTrap) {
      this._trapFocus();
    }
  }

  protected _openAnimationDone() {
    if (this._config.delayFocusTrap) {
      this._trapFocus();
    }
  }
}
