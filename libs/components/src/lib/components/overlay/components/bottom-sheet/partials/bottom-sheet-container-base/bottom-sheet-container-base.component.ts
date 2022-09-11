import { CdkDialogContainer } from '@angular/cdk/dialog';
import { FocusMonitor, FocusTrapFactory, InteractivityChecker } from '@angular/cdk/a11y';
import { OverlayRef } from '@angular/cdk/overlay';
import { DOCUMENT } from '@angular/common';
import { Component, ElementRef, EventEmitter, Inject, NgZone, Optional } from '@angular/core';
import { BottomSheetConfig } from '../../utils';
import { LegacyBottomSheetAnimationEvent } from '../../types';

@Component({ template: '' })
export abstract class BottomSheetContainerBaseComponent extends CdkDialogContainer<BottomSheetConfig> {
  _animationStateChanged = new EventEmitter<LegacyBottomSheetAnimationEvent>();

  constructor(
    public elementRef: ElementRef,
    focusTrapFactory: FocusTrapFactory,
    @Optional() @Inject(DOCUMENT) _document: Document,
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

  abstract _startExitAnimation(): void;

  protected override _captureInitialFocus(): void {
    if (!this._config.delayFocusTrap) {
      this._trapFocus();
    }
  }

  protected _openAnimationDone(totalTime: number) {
    if (this._config.delayFocusTrap) {
      this._trapFocus();
    }

    this._animationStateChanged.next({ state: 'opened', totalTime });
  }
}
