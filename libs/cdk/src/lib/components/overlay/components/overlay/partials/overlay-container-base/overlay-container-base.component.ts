import { FocusMonitor, FocusTrapFactory, InteractivityChecker } from '@angular/cdk/a11y';
import { CdkDialogContainer } from '@angular/cdk/dialog';
import { OverlayRef } from '@angular/cdk/overlay';
import { DOCUMENT } from '@angular/common';
import { Component, ElementRef, Inject, NgZone, Optional, inject } from '@angular/core';
import { ANIMATED_LIFECYCLE_TOKEN } from '@ethlete/core';
import { OVERLAY_CONFIG } from '../../constants';
import { OverlayConfig } from '../../types';

@Component({ template: '' })
export abstract class OverlayContainerBaseComponent extends CdkDialogContainer<OverlayConfig> {
  readonly _animatedLifecycle = inject(ANIMATED_LIFECYCLE_TOKEN);

  constructor(
    public elementRef: ElementRef<HTMLElement>,
    focusTrapFactory: FocusTrapFactory,
    @Optional() @Inject(DOCUMENT) _document: Document,
    @Inject(OVERLAY_CONFIG)
    overlayConfig: OverlayConfig,
    interactivityChecker: InteractivityChecker,
    ngZone: NgZone,
    public overlayRef: OverlayRef,
    focusMonitor?: FocusMonitor,
  ) {
    super(
      elementRef,
      focusTrapFactory,
      _document,
      overlayConfig,
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
