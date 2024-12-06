import { FocusMonitor, FocusTrapFactory, InteractivityChecker } from '@angular/cdk/a11y';
import { CdkDialogContainer } from '@angular/cdk/dialog';
import { OverlayRef } from '@angular/cdk/overlay';
import { DOCUMENT } from '@angular/common';
import { Component, ElementRef, Inject, NgZone, Optional, inject } from '@angular/core';
import { ANIMATED_LIFECYCLE_TOKEN } from '@ethlete/core';
import { DIALOG_CONFIG } from '../../constants';
import { DialogConfig } from '../../types';

/**
 * @deprecated Will be removed in v5.
 */
@Component({
  selector: 'et-dialog-container-base',
  template: '',
  standalone: false,
})
export abstract class DialogContainerBaseComponent extends CdkDialogContainer<DialogConfig> {
  readonly _animatedLifecycle = inject(ANIMATED_LIFECYCLE_TOKEN);

  constructor(
    public elementRef: ElementRef<HTMLElement>,
    focusTrapFactory: FocusTrapFactory,
    @Optional() @Inject(DOCUMENT) _document: Document,
    @Inject(DIALOG_CONFIG)
    dialogConfig: DialogConfig,
    interactivityChecker: InteractivityChecker,
    ngZone: NgZone,
    public overlayRef: OverlayRef,
    focusMonitor?: FocusMonitor,
  ) {
    super(
      elementRef,
      focusTrapFactory,
      _document,
      dialogConfig,
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
