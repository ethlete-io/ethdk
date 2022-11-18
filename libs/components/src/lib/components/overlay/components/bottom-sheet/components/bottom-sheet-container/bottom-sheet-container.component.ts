import { FocusMonitor, FocusTrapFactory, InteractivityChecker } from '@angular/cdk/a11y';
import { OverlayRef } from '@angular/cdk/overlay';
import { PortalModule } from '@angular/cdk/portal';
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
import { BOTTOM_SHEET_ANIMATION_CLASSES, BOTTOM_SHEET_TRANSITION_DURATION_PROPERTY } from '../../constants';
import { BottomSheetContainerBaseComponent } from '../../partials';
import { BottomSheetConfig } from '../../utils';

@Component({
  selector: 'et-bottom-sheet-container',
  styleUrls: ['./bottom-sheet-container.component.scss'],
  template: `<ng-template cdkPortalOutlet></ng-template>`,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'et-bottom-sheet',
    tabindex: '-1',
    '[attr.aria-modal]': '_config.ariaModal',
    '[id]': '_config.id',
    '[attr.role]': '_config.role',
    '[attr.aria-labelledby]': '_config.ariaLabel ? null : _ariaLabelledBy',
    '[attr.aria-label]': '_config.ariaLabel',
    '[attr.aria-describedby]': '_config.ariaDescribedBy || null',
    '[class.et-with-default-animation]': '!_config.customAnimated',
    '[class]': '_config.containerClass',
  },
  standalone: true,
  imports: [PortalModule],
})
export class BottomSheetContainerComponent extends BottomSheetContainerBaseComponent implements OnDestroy {
  private _hostElement: HTMLElement = this._elementRef.nativeElement;
  private _openAnimationDuration = this._config.enterAnimationDuration ?? 300;
  private _closeAnimationDuration = this._config.exitAnimationDuration ?? 100;
  private _animationTimer: number | null = null;

  constructor(
    elementRef: ElementRef,
    focusTrapFactory: FocusTrapFactory,
    @Optional() @Inject(DOCUMENT) document: Document,
    bottomSheetConfig: BottomSheetConfig,
    checker: InteractivityChecker,
    ngZone: NgZone,
    overlayRef: OverlayRef,
    focusMonitor?: FocusMonitor,
  ) {
    super(elementRef, focusTrapFactory, document, bottomSheetConfig, checker, ngZone, overlayRef, focusMonitor);
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
    setTimeout(() => {
      this._animationStateChanged.emit({ state: 'opening', totalTime: this._openAnimationDuration });

      this._hostElement.style.setProperty(
        BOTTOM_SHEET_TRANSITION_DURATION_PROPERTY,
        `${this._openAnimationDuration}ms`,
      );
      this._hostElement.classList.add(BOTTOM_SHEET_ANIMATION_CLASSES.opening);

      this._waitForAnimationToComplete(this._openAnimationDuration, this._finishBottomSheetOpen);
    });
  }

  _startExitAnimation(): void {
    if (this._animationTimer !== null) {
      clearTimeout(this._animationTimer);
      this._clearAnimationClasses();
    }

    this._animationStateChanged.emit({ state: 'closing', totalTime: this._closeAnimationDuration });
    this._hostElement.classList.remove(BOTTOM_SHEET_ANIMATION_CLASSES.open);
    this._hostElement.style.setProperty(BOTTOM_SHEET_TRANSITION_DURATION_PROPERTY, `${this._closeAnimationDuration}ms`);
    this._hostElement.classList.add(BOTTOM_SHEET_ANIMATION_CLASSES.closing);
    this._waitForAnimationToComplete(this._closeAnimationDuration, this._finishBottomSheetClose);
  }

  private _finishBottomSheetOpen = () => {
    this._clearAnimationClasses();
    this._openAnimationDone(this._openAnimationDuration);
    this._hostElement.classList.add(BOTTOM_SHEET_ANIMATION_CLASSES.open);
  };

  private _clearAnimationClasses() {
    this._hostElement.classList.remove(BOTTOM_SHEET_ANIMATION_CLASSES.opening);
    this._hostElement.classList.remove(BOTTOM_SHEET_ANIMATION_CLASSES.closing);
  }

  private _finishBottomSheetClose = () => {
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
