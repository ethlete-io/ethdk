import { NgIf } from '@angular/common';
import { Component, inject, Injectable, Injector, ViewContainerRef } from '@angular/core';
import { OverlayImports } from '../../overlay.imports';
import { OverlayService } from '../../services';
import { OverlayStorybookComponent } from './overlay.storybook.component';

@Injectable()
export class StorybookExampleService {}

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

    <br /><br />

    <button (click)="dialogWithInjector()" type="button">Dialog with injector</button> <br />
    <button (click)="dialogWithViewContainerRef()" type="button">Dialog with view container ref</button> <br />

    <div *ngIf="_isScrollable" style="background:#171717; height:200vh; margin-top: 2rem"></div>
  `,
  standalone: true,
  imports: [OverlayImports, NgIf],
})
export class OverlayHostStorybookComponent {
  private readonly _overlayService = inject(OverlayService);

  private readonly _vcr = inject(ViewContainerRef);
  private readonly _injector = inject(Injector);

  _isScrollable = false;

  toggleScrollable() {
    this._isScrollable = !this._isScrollable;
  }

  topSheet() {
    this._overlayService.open(OverlayStorybookComponent, {
      positions: this._overlayService.positions.topSheet({}),
    });
  }

  bottomSheet() {
    this._overlayService.open(OverlayStorybookComponent, {
      positions: this._overlayService.positions.bottomSheet({}),
    });
  }

  leftSheet() {
    this._overlayService.open(OverlayStorybookComponent, {
      positions: this._overlayService.positions.leftSheet({}),
    });
  }

  rightSheet() {
    this._overlayService.open(OverlayStorybookComponent, {
      positions: this._overlayService.positions.rightSheet({}),
    });
  }

  fullScreenDialog(event: MouseEvent | TouchEvent) {
    this._overlayService.open(OverlayStorybookComponent, {
      origin: event,
      positions: this._overlayService.positions.fullScreenDialog({}),
    });
  }

  dialog() {
    this._overlayService.open(OverlayStorybookComponent, {
      positions: this._overlayService.positions.dialog({}),
    });
  }

  dialogWithViewContainerRef() {
    this._overlayService.open(OverlayStorybookComponent, {
      viewContainerRef: this._vcr,
      positions: this._overlayService.positions.dialog({}),
    });
  }

  dialogWithInjector() {
    this._overlayService.open(OverlayStorybookComponent, {
      injector: this._injector,
      positions: this._overlayService.positions.dialog({}),
    });
  }

  transformingBottomSheetToDialog() {
    this._overlayService.open(OverlayStorybookComponent, {
      positions: this._overlayService.positions.transformingBottomSheetToDialog({}),
    });
  }
}
