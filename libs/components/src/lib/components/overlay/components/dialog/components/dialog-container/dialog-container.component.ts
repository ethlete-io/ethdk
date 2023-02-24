import { FocusMonitor, FocusTrapFactory, InteractivityChecker } from '@angular/cdk/a11y';
import { OverlayRef } from '@angular/cdk/overlay';
import { PortalModule } from '@angular/cdk/portal';
import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  Inject,
  NgZone,
  OnDestroy,
  OnInit,
  Optional,
  ViewEncapsulation,
} from '@angular/core';
import { AnimatableDirective, ANIMATABLE_TOKEN, DestroyService } from '@ethlete/core';
import { takeUntil, tap } from 'rxjs';
import { DIALOG_ANIMATION_CLASSES, DIALOG_CONFIG } from '../../constants';
import { DialogContainerBaseComponent } from '../../partials';
import { DialogConfig } from '../../types';

@Component({
  selector: 'et-dialog-container',
  styleUrls: ['./dialog-container.component.scss'],
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
    '[class.et-with-default-animation]': '!_config.customAnimated',
    '[class]': '_config.containerClass',
  },
  standalone: true,
  imports: [PortalModule],
  hostDirectives: [AnimatableDirective],
  providers: [DestroyService],
})
export class DialogContainerComponent extends DialogContainerBaseComponent implements OnInit, OnDestroy {
  private _hostElement: HTMLElement = this._elementRef.nativeElement;

  private readonly _animatable = inject(ANIMATABLE_TOKEN);
  private readonly _destroy$ = inject(DestroyService, { host: true }).destroy$;

  constructor(
    elementRef: ElementRef,
    focusTrapFactory: FocusTrapFactory,
    @Optional() @Inject(DOCUMENT) document: Document,
    @Inject(DIALOG_CONFIG)
    dialogConfig: DialogConfig,
    checker: InteractivityChecker,
    ngZone: NgZone,
    overlayRef: OverlayRef,
    focusMonitor?: FocusMonitor,
  ) {
    super(elementRef, focusTrapFactory, document, dialogConfig, checker, ngZone, overlayRef, focusMonitor);
  }

  ngOnInit(): void {
    this._animatable.animationEnd$
      .pipe(
        takeUntil(this._destroy$),
        tap(() => {
          const isOpening = this._hostElement.classList.contains(DIALOG_ANIMATION_CLASSES.opening);

          if (isOpening) {
            this._finishDialogOpen();
          } else {
            this._finishDialogClose();
          }

          this._clearAnimationClasses();
        }),
      )
      .subscribe();
  }

  protected override _contentAttached(): void {
    super._contentAttached();
    this._startOpenAnimation();
  }

  private _startOpenAnimation() {
    setTimeout(() => {
      this._animationStateChanged.emit({ state: 'opening' });
      this._hostElement.classList.add(DIALOG_ANIMATION_CLASSES.opening);
    });
  }

  _startExitAnimation(): void {
    this._animationStateChanged.emit({ state: 'closing' });
    this._hostElement.classList.remove(DIALOG_ANIMATION_CLASSES.open);
    this._hostElement.classList.remove(DIALOG_ANIMATION_CLASSES.opening);
    this._hostElement.classList.add(DIALOG_ANIMATION_CLASSES.closing);
  }

  private _finishDialogOpen = () => {
    this._openAnimationDone();
    this._hostElement.classList.add(DIALOG_ANIMATION_CLASSES.open);
  };

  private _finishDialogClose = () => {
    this._animationStateChanged.emit({ state: 'closed' });
  };

  private _clearAnimationClasses() {
    this._hostElement.classList.remove(DIALOG_ANIMATION_CLASSES.opening);
    this._hostElement.classList.remove(DIALOG_ANIMATION_CLASSES.closing);
  }
}
