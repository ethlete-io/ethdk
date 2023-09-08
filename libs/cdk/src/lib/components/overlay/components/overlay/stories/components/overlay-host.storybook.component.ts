import { NgIf } from '@angular/common';
import { Component, inject, Input } from '@angular/core';
import { OverlayImports, provideOverlay } from '../../overlay.imports';
import { OverlayService } from '../../services';
import { createOverlayConfig } from '../../utils';
import { OverlayStorybookComponent } from './overlay.storybook.component';

@Component({
  selector: 'et-sb-overlay-host',
  template: `
    <button (click)="showDialog()" type="button">Show dialog</button> <br />
    <br />
    <button (click)="toggleScrollable()" type="button">Toggle scrollable</button> <br />
    <div *ngIf="_isScrollable" style="background:#171717; height:200vh; margin-top: 2rem"></div>
  `,
  standalone: true,
  imports: [OverlayImports, NgIf],
  providers: [provideOverlay()],
})
export class OverlayHostStorybookComponent {
  private readonly _defaultConfig = createOverlayConfig();
  private readonly _overlayService = inject(OverlayService);

  @Input()
  ariaDescribedBy = this._defaultConfig.ariaDescribedBy;

  @Input()
  ariaLabel = this._defaultConfig.ariaLabel;

  @Input()
  ariaLabelledBy = this._defaultConfig.ariaLabelledBy;

  @Input()
  autoFocus = this._defaultConfig.autoFocus;

  @Input()
  closeOnNavigation = this._defaultConfig.closeOnNavigation;

  @Input()
  data = this._defaultConfig.data;

  @Input()
  delayFocusTrap = this._defaultConfig.delayFocusTrap;

  @Input()
  direction = this._defaultConfig.direction;

  @Input()
  disableClose = this._defaultConfig.disableClose;

  @Input()
  hasBackdrop = this._defaultConfig.hasBackdrop;

  @Input()
  id = this._defaultConfig.id;

  @Input()
  injector = this._defaultConfig.injector;

  @Input()
  customAnimated = this._defaultConfig.customAnimated;

  @Input()
  restoreFocus = this._defaultConfig.restoreFocus;

  @Input()
  role = this._defaultConfig.role;

  @Input()
  scrollStrategy = this._defaultConfig.scrollStrategy;

  @Input()
  viewContainerRef = this._defaultConfig.viewContainerRef;

  _isScrollable = false;

  toggleScrollable() {
    this._isScrollable = !this._isScrollable;
  }

  showDialog() {
    this._overlayService.open(OverlayStorybookComponent, {
      ...this,
      positions: this._overlayService.positions.transformingBottomSheetToDialog({
        bottomSheet: {
          height: 'auto',
        },
      }),
    });
  }
}
