import { FocusMonitor, FocusTrapFactory, InteractivityChecker } from '@angular/cdk/a11y';
import { OverlayRef } from '@angular/cdk/overlay';
import { PortalModule } from '@angular/cdk/portal';
import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, NgZone, ViewEncapsulation, inject } from '@angular/core';
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
  override overlayRef: OverlayRef;

  get _ariaLabelledByHack() {
    // @ts-expect-error private property
    return super._ariaLabelledBy;
  }

  constructor() {
    const elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
    const focusTrapFactory = inject(FocusTrapFactory);
    const document = inject<Document>(DOCUMENT);
    const dialogConfig = inject<DialogConfig>(DIALOG_CONFIG);
    const checker = inject(InteractivityChecker);
    const ngZone = inject(NgZone);
    const overlayRef = inject(OverlayRef);
    const focusMonitor = inject(FocusMonitor);

    super(elementRef, focusTrapFactory, document, dialogConfig, checker, ngZone, overlayRef, focusMonitor);

    this.overlayRef = overlayRef;
  }

  protected override _contentAttached(): void {
    super._contentAttached();

    nextFrame(() => {
      this._animatedLifecycle.enter();
    });
  }
}
