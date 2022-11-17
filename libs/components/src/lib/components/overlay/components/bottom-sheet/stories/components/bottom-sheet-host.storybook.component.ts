import { NgIf } from '@angular/common';
import { Component, inject, Input } from '@angular/core';
import { BottomSheetModule } from '../../bottom-sheet.module';
import { BottomSheetService } from '../../services';
import { BottomSheetConfig } from '../../utils';
import { BottomSheetStorybookComponent } from './bottom-sheet.storybook.component';

@Component({
  selector: 'et-sb-bottom-sheet-host',
  template: `
    <button (click)="showBottomSheet()" type="button">Show bottom sheet</button> <br />
    <br />
    <button (click)="toggleScrollable()" type="button">Toggle scrollable</button> <br />
    <div *ngIf="_isScrollable" style="background:#171717; height:200vh; margin-top: 2rem"></div>
  `,
  standalone: true,
  imports: [BottomSheetModule, NgIf],
})
export class BottomSheetHostStorybookComponent {
  private readonly _bottomSheetService = inject(BottomSheetService);
  private readonly _defaultConfig = new BottomSheetConfig();

  @Input()
  ariaLabel = this._defaultConfig.ariaLabel;

  @Input()
  autoFocus = this._defaultConfig.autoFocus;

  @Input()
  backdropClass = this._defaultConfig.backdropClass;

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
  enterAnimationDuration = this._defaultConfig.enterAnimationDuration;

  @Input()
  exitAnimationDuration = this._defaultConfig.exitAnimationDuration;

  @Input()
  hasBackdrop = this._defaultConfig.hasBackdrop;

  @Input()
  id = this._defaultConfig.id;

  @Input()
  panelClass = this._defaultConfig.panelClass;

  @Input()
  containerClass = this._defaultConfig.containerClass;

  @Input()
  customAnimated = this._defaultConfig.customAnimated;

  @Input()
  restoreFocus = this._defaultConfig.restoreFocus;

  @Input()
  scrollStrategy = this._defaultConfig.scrollStrategy;

  @Input()
  viewContainerRef = this._defaultConfig.viewContainerRef;

  _isScrollable = false;

  toggleScrollable() {
    this._isScrollable = !this._isScrollable;
  }

  showBottomSheet() {
    this._bottomSheetService.open(BottomSheetStorybookComponent, this);
  }
}
