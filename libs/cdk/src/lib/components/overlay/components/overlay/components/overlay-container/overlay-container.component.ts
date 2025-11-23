import { CdkDialogContainer } from '@angular/cdk/dialog';
import { OverlayRef as CdkOverlayRef } from '@angular/cdk/overlay';
import { PortalModule } from '@angular/cdk/portal';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import {
  ANIMATED_LIFECYCLE_TOKEN,
  AnimatedLifecycleDirective,
  ProvideThemeDirective,
  THEME_PROVIDER,
  injectBoundaryElement,
  nextFrame,
  provideBoundaryElement,
} from '@ethlete/core';
import { BehaviorSubject } from 'rxjs';
import { OverlayConfig } from '../../types';
import { OverlayRef } from '../../utils';

@Component({
  selector: 'et-overlay-container',
  styleUrls: ['./overlay-container.component.scss'],
  template: `
    <div class="et-overlay-container-drag-handle"></div>
    <ng-template cdkPortalOutlet />
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'et-overlay',
    tabindex: '-1',
    '[attr.aria-modal]': '_config.ariaModal',
    '[id]': '_config.id',
    '[attr.role]': '_config.role',
    '[attr.aria-labelledby]': '_config.ariaLabel ? null : _ariaLabelledByQueue[0]',
    '[attr.aria-label]': '_config.ariaLabel',
    '[attr.aria-describedby]': '_config.ariaDescribedBy || null',
    '[class.et-with-default-animation]': '!_config.customAnimated',
  },
  imports: [PortalModule],
  hostDirectives: [AnimatedLifecycleDirective, ProvideThemeDirective],
  providers: [provideBoundaryElement()],
})
export class OverlayContainerComponent extends CdkDialogContainer<OverlayConfig> {
  private parentThemeProvider = inject(THEME_PROVIDER, { optional: true, skipSelf: true });

  themeProvider = inject(THEME_PROVIDER);
  rootBoundary = injectBoundaryElement();
  animatedLifecycle = inject(ANIMATED_LIFECYCLE_TOKEN);
  cdkOverlayRef = inject(CdkOverlayRef);
  elementRef = this._elementRef;

  overlayRef: OverlayRef | null = null;

  isContentAttached$ = new BehaviorSubject(false);

  constructor() {
    super();

    if (this.parentThemeProvider) {
      this.themeProvider.syncWithProvider(this.parentThemeProvider);
    }
  }

  protected override _contentAttached(): void {
    super._contentAttached();

    this.rootBoundary.override.set(this._elementRef.nativeElement);

    nextFrame(() => {
      this.isContentAttached$.next(true);
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
