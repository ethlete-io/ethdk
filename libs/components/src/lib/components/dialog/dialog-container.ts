import { FocusMonitor, FocusTrapFactory, InteractivityChecker } from '@angular/cdk/a11y';
import { OverlayRef } from '@angular/cdk/overlay';
import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Inject,
  NgZone,
  OnDestroy,
  Optional,
  ViewEncapsulation,
} from '@angular/core';
import { DialogConfig } from './dialog-config';
import { DialogContainerBaseComponent } from './dialog-container-base';

const TRANSITION_DURATION_PROPERTY = '--et-dialog-transition-duration';

const DIALOG_CLASSES = {
  opening: 'et-dialog--opening',
  open: 'et-dialog--open',
  closing: 'et-dialog--closing',
  closed: 'et-dialog--closed',
};

@Component({
  selector: 'et-dialog-container',
  template: `<ng-template cdkPortalOutlet></ng-template>`,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'et-dialog',
    tabindex: '-1',
    '[attr.aria-modal]': '_config.ariaModal',
    '[id]': '_config.id',
    '[attr.role]': '_config.role',
    '[attr.aria-labelledby]': '_config.ariaLabel ? null : _ariaLabelledBy',
    '[attr.aria-label]': '_config.ariaLabel',
    '[attr.aria-describedby]': '_config.ariaDescribedBy || null',
  },
})
export class DialogContainerComponent extends DialogContainerBaseComponent implements OnDestroy {
  private _hostElement: HTMLElement = this._elementRef.nativeElement;
  private _openAnimationDuration = this._config.enterAnimationDuration ?? 300;
  private _closeAnimationDuration = this._config.exitAnimationDuration ?? 100;
  private _animationTimer: number | null = null;

  constructor(
    elementRef: ElementRef,
    focusTrapFactory: FocusTrapFactory,
    @Optional() @Inject(DOCUMENT) document: Document,
    dialogConfig: DialogConfig,
    checker: InteractivityChecker,
    ngZone: NgZone,
    overlayRef: OverlayRef,
    focusMonitor?: FocusMonitor,
  ) {
    super(elementRef, focusTrapFactory, document, dialogConfig, checker, ngZone, overlayRef, focusMonitor);
  }

  protected override _contentAttached(): void {
    super._contentAttached();
    this._startOpenAnimation();
  }

  override ngOnDestroy() {
    super.ngOnDestroy();

    if (this._animationTimer !== null) {
      clearTimeout(this._animationTimer);
    }
  }

  private _startOpenAnimation() {
    this._animationStateChanged.emit({ state: 'opening', totalTime: this._openAnimationDuration });

    this._hostElement.style.setProperty(TRANSITION_DURATION_PROPERTY, `${this._openAnimationDuration}ms`);
    this._hostElement.classList.add(DIALOG_CLASSES.opening);
    this._hostElement.classList.add(DIALOG_CLASSES.open);

    this._waitForAnimationToComplete(this._openAnimationDuration, this._finishDialogOpen);
  }

  _startExitAnimation(): void {
    this._animationStateChanged.emit({ state: 'closing', totalTime: this._closeAnimationDuration });
    this._hostElement.classList.remove(DIALOG_CLASSES.open);
    this._hostElement.style.setProperty(TRANSITION_DURATION_PROPERTY, `${this._closeAnimationDuration}ms`);
    this._hostElement.classList.add(DIALOG_CLASSES.closing);
    this._waitForAnimationToComplete(this._closeAnimationDuration, this._finishDialogClose);
  }

  private _finishDialogOpen = () => {
    this._clearAnimationClasses();
    this._openAnimationDone(this._openAnimationDuration);
  };

  private _clearAnimationClasses() {
    this._hostElement.classList.remove(DIALOG_CLASSES.opening);
    this._hostElement.classList.remove(DIALOG_CLASSES.closing);
  }

  private _finishDialogClose = () => {
    this._clearAnimationClasses();
    this._animationStateChanged.emit({ state: 'closed', totalTime: this._closeAnimationDuration });
  };

  private _waitForAnimationToComplete(duration: number, callback: () => void) {
    if (this._animationTimer !== null) {
      clearTimeout(this._animationTimer);
    }

    this._animationTimer = window.setTimeout(callback, duration);
  }
}
