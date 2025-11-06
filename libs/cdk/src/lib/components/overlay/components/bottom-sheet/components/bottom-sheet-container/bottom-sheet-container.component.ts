import { FocusMonitor, FocusTrapFactory, InteractivityChecker } from '@angular/cdk/a11y';
import { OverlayRef } from '@angular/cdk/overlay';
import { PortalModule } from '@angular/cdk/portal';
import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, NgZone, ViewEncapsulation, inject } from '@angular/core';
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
    role: 'dialog',
    '[attr.aria-labelledby]': '_config.ariaLabel ? null : _ariaLabelledByHack',
    '[attr.aria-label]': '_config.ariaLabel',
    '[class.et-with-default-animation]': '!_config.customAnimated',
    '[class]': '_config.containerClass',
  },
  imports: [PortalModule],
  hostDirectives: [AnimatedLifecycleDirective],
})
export class BottomSheetContainerComponent extends BottomSheetContainerBaseComponent {
  override overlayRef: OverlayRef;

  get _ariaLabelledByHack() {
    // @ts-expect-error private property
    return super._ariaLabelledBy;
  }

  constructor() {
    const elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
    const focusTrapFactory = inject(FocusTrapFactory);
    const document = inject<Document>(DOCUMENT);
    const bottomSheetConfig = inject<BottomSheetConfig>(BOTTOM_SHEET_CONFIG);
    const checker = inject(InteractivityChecker);
    const ngZone = inject(NgZone);
    const overlayRef = inject(OverlayRef);
    const focusMonitor = inject(FocusMonitor);

    super(elementRef, focusTrapFactory, document, bottomSheetConfig, checker, ngZone, overlayRef, focusMonitor);

    this.overlayRef = overlayRef;
  }

  protected override _contentAttached(): void {
    super._contentAttached();

    nextFrame(() => {
      this._animatedLifecycle.enter();
    });
  }
}
