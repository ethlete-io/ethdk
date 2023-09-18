import { NgIf } from '@angular/common';
import { Component, inject, Input } from '@angular/core';
import { OverlayImports, provideOverlay } from '../../overlay.imports';
import { OverlayService } from '../../services';
import { createOverlayConfig } from '../../utils';
import { OverlayStorybookComponent } from './overlay.storybook.component';

@Component({
  selector: 'et-sb-overlay-host',
  template: `
    <button (click)="topSheet()" type="button">Top sheet</button> <br />
    <button (click)="bottomSheet()" type="button">Bottom sheet</button> <br />
    <button (click)="leftSheet()" type="button">Left sheet</button> <br />
    <button (click)="rightSheet()" type="button">Right sheet</button> <br />
    <button (click)="fullScreenDialog($event)" type="button">Full screen dialog</button> <br />
    <button (click)="dialog()" type="button">Dialog</button> <br />
    <button (click)="transformingBottomSheetToDialog()" type="button">Transforming bottom sheet to dialog</button>
    <br />

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

  topSheet() {
    this._overlayService.open(OverlayStorybookComponent, {
      ...this,
      positions: this._overlayService.positions.topSheet({}),
    });
  }

  bottomSheet() {
    this._overlayService.open(OverlayStorybookComponent, {
      ...this,
      positions: this._overlayService.positions.bottomSheet({}),
    });
  }

  leftSheet() {
    this._overlayService.open(OverlayStorybookComponent, {
      ...this,
      positions: this._overlayService.positions.leftSheet({}),
    });
  }

  rightSheet() {
    this._overlayService.open(OverlayStorybookComponent, {
      ...this,
      positions: this._overlayService.positions.rightSheet({}),
    });
  }

  fullScreenDialog(event: MouseEvent | TouchEvent) {
    this._overlayService.open(OverlayStorybookComponent, {
      ...this,
      origin: event,
      positions: [
        {
          config: this._overlayService.positions.DEFAULTS.fullScreenDialog,
        },
        {
          breakpoint: 'md',
          config: this._overlayService.positions.DEFAULTS.rightSheet,
        },
      ],
    });
  }

  dialog() {
    this._overlayService.open(OverlayStorybookComponent, {
      ...this,
      positions: this._overlayService.positions.dialog({}),
    });
  }

  transformingBottomSheetToDialog() {
    this._overlayService.open(OverlayStorybookComponent, {
      ...this,
      positions: this._overlayService.positions.transformingBottomSheetToDialog({}),
    });
  }
}
