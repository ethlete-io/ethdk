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
import { DIALOG_CONFIG } from '../../constants';
import { DialogContainerBaseComponent } from '../../partials/dialog-container-base';
import { DialogConfig } from '../../types';

/**
 * @deprecated Will be removed in v5.
 */
@Component({
  selector: 'et-dialog-container',
  styleUrls: ['./dialog-container.component.scss'],
  template: `<ng-template cdkPortalOutlet />`,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'et-dialog',
    tabindex: '-1',
    '[attr.aria-modal]': '_config.ariaModal',
    '[id]': '_config.id',
    '[attr.role]': '_config.role',
    '[attr.aria-labelledby]': '_config.ariaLabel ? null : _ariaLabelledByHack',
    '[attr.aria-label]': '_config.ariaLabel',
    '[attr.aria-describedby]': '_config.ariaDescribedBy || null',
    '[class.et-with-default-animation]': '!_config.customAnimated',
    '[class]': '_config.containerClass',
  },
  imports: [PortalModule],
  hostDirectives: [AnimatedLifecycleDirective],
})
export class DialogContainerComponent extends DialogContainerBaseComponent {
  get _ariaLabelledByHack() {
    // @ts-expect-error private property
    return super._ariaLabelledBy;
  }

  constructor(
    elementRef: ElementRef<HTMLElement>,
    focusTrapFactory: FocusTrapFactory,
    @Optional() @Inject(DOCUMENT) document: Document,
    @Inject(DIALOG_CONFIG)
    dialogConfig: DialogConfig,
    checker: InteractivityChecker,
    ngZone: NgZone,
    public override overlayRef: OverlayRef,
    focusMonitor?: FocusMonitor,
  ) {
    super(elementRef, focusTrapFactory, document, dialogConfig, checker, ngZone, overlayRef, focusMonitor);
  }

  protected override _contentAttached(): void {
    super._contentAttached();

    nextFrame(() => {
      this._animatedLifecycle.enter();
    });
  }
}
