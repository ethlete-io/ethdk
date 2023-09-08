import { FocusMonitor, FocusTrapFactory, InteractivityChecker } from '@angular/cdk/a11y';
import { CdkDialogContainer } from '@angular/cdk/dialog';
import { OverlayRef } from '@angular/cdk/overlay';
import { PortalModule } from '@angular/cdk/portal';
import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, NgZone, ViewEncapsulation, inject } from '@angular/core';
import { ANIMATED_LIFECYCLE_TOKEN, AnimatedLifecycleDirective, nextFrame } from '@ethlete/core';
import { OVERLAY_CONFIG } from '../../constants';
import { OverlayConfig } from '../../types';

@Component({
  selector: 'et-overlay-container',
  styleUrls: ['./overlay-container.component.scss'],
  template: `<ng-template cdkPortalOutlet></ng-template>`,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'et-overlay',
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
  hostDirectives: [AnimatedLifecycleDirective],
})
export class OverlayContainerComponent extends CdkDialogContainer<OverlayConfig> {
  readonly _animatedLifecycle = inject(ANIMATED_LIFECYCLE_TOKEN);
  readonly overlayRef = inject(OverlayRef);

  constructor() {
    super(
      inject(ElementRef),
      inject(FocusTrapFactory),
      inject(DOCUMENT),
      inject(OVERLAY_CONFIG),
      inject(InteractivityChecker),
      inject(NgZone),
      inject(OverlayRef),
      inject(FocusMonitor),
    );
  }

  protected override _contentAttached(): void {
    super._contentAttached();

    nextFrame(() => {
      this._animatedLifecycle.enter();
    });
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
