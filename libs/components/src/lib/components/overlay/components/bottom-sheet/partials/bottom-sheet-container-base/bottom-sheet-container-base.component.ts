import { FocusMonitor, FocusTrapFactory, InteractivityChecker } from '@angular/cdk/a11y';
import { CdkDialogContainer } from '@angular/cdk/dialog';
import { OverlayRef } from '@angular/cdk/overlay';
import { DOCUMENT } from '@angular/common';
import { Component, ElementRef, inject, Inject, NgZone, Optional } from '@angular/core';
import { ANIMATED_LIFECYCLE_TOKEN } from '@ethlete/core';
import { BOTTOM_SHEET_CONFIG } from '../../constants';
import { BottomSheetConfig } from '../../types';

@Component({ template: '' })
export abstract class BottomSheetContainerBaseComponent extends CdkDialogContainer<BottomSheetConfig> {
  readonly _animatedLifecycle = inject(ANIMATED_LIFECYCLE_TOKEN);

  constructor(
    public elementRef: ElementRef,
    focusTrapFactory: FocusTrapFactory,
    @Optional() @Inject(DOCUMENT) _document: Document,
    @Inject(BOTTOM_SHEET_CONFIG)
    bottomSheetConfig: BottomSheetConfig,
    interactivityChecker: InteractivityChecker,
    ngZone: NgZone,
    overlayRef: OverlayRef,
    focusMonitor?: FocusMonitor,
  ) {
    super(
      elementRef,
      focusTrapFactory,
      _document,
      bottomSheetConfig,
      interactivityChecker,
      ngZone,
      overlayRef,
      focusMonitor,
    );
  }

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
