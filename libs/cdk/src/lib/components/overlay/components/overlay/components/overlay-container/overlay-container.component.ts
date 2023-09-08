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
import { OVERLAY_CONFIG } from '../../constants';
import { OverlayContainerBaseComponent } from '../../partials';
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
export class OverlayContainerComponent extends OverlayContainerBaseComponent {
  constructor(
    elementRef: ElementRef<HTMLElement>,
    focusTrapFactory: FocusTrapFactory,
    @Optional() @Inject(DOCUMENT) document: Document,
    @Inject(OVERLAY_CONFIG)
    overlayConfig: OverlayConfig,
    checker: InteractivityChecker,
    ngZone: NgZone,
    public override overlayRef: OverlayRef,
    focusMonitor?: FocusMonitor,
  ) {
    super(elementRef, focusTrapFactory, document, overlayConfig, checker, ngZone, overlayRef, focusMonitor);
  }

  protected override _contentAttached(): void {
    super._contentAttached();

    nextFrame(() => {
      this._animatedLifecycle.enter();
    });
  }
}
