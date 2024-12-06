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
  Optional,
  ViewEncapsulation,
} from '@angular/core';
import { AnimatedLifecycleDirective, nextFrame } from '@ethlete/core';
import { BOTTOM_SHEET_CONFIG } from '../../constants';
import { BottomSheetContainerBaseComponent } from '../../partials/bottom-sheet-container-base';
import { BottomSheetConfig } from '../../types';

/**
 * @deprecated Will be removed in v5.
 */
@Component({
  selector: 'et-bottom-sheet-container',
  styleUrls: ['./bottom-sheet-container.component.scss'],
  template: `<ng-template cdkPortalOutlet />`,
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
  imports: [PortalModule],
  hostDirectives: [AnimatedLifecycleDirective],
})
export class BottomSheetContainerComponent extends BottomSheetContainerBaseComponent {
  constructor(
    elementRef: ElementRef<HTMLElement>,
    focusTrapFactory: FocusTrapFactory,
    @Optional() @Inject(DOCUMENT) document: Document,
    @Inject(BOTTOM_SHEET_CONFIG)
    bottomSheetConfig: BottomSheetConfig,
    checker: InteractivityChecker,
    ngZone: NgZone,
    public override overlayRef: OverlayRef,
    focusMonitor?: FocusMonitor,
  ) {
    super(elementRef, focusTrapFactory, document, bottomSheetConfig, checker, ngZone, overlayRef, focusMonitor);
  }

  protected override _contentAttached(): void {
    super._contentAttached();

    nextFrame(() => {
      this._animatedLifecycle.enter();
    });
  }
}
