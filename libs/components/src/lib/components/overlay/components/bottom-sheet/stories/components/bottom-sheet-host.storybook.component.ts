import { Direction } from '@angular/cdk/bidi';
import { ScrollStrategy } from '@angular/cdk/overlay';
import { Component, Input, ViewContainerRef } from '@angular/core';
import { BottomSheetModule } from '../../bottom-sheet.module';
import { BottomSheetService } from '../../services';
import { BottomSheetConfig } from '../../utils';
import { BottomSheetStorybookComponent } from './bottom-sheet.storybook.component';

@Component({
  selector: 'et-sb-bottom-sheet-host',
  template: `<button (click)="showBottomSheet()" type="button">Show bottom sheet</button>`,
  standalone: true,
  imports: [BottomSheetModule],
})
export class BottomSheetHostStorybookComponent {
  private _defaultConfig = new BottomSheetConfig();

  @Input()
  disableClose = this._defaultConfig.disableClose;

  @Input()
  hasBackdrop = this._defaultConfig.hasBackdrop;

  @Input()
  restoreFocus = this._defaultConfig.restoreFocus;

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
  direction = this._defaultConfig.direction;

  @Input()
  delayFocusTrap = this._defaultConfig.delayFocusTrap;

  @Input()
  enterAnimationDuration = this._defaultConfig.enterAnimationDuration;

  @Input()
  exitAnimationDuration = this._defaultConfig.exitAnimationDuration;

  @Input()
  id = this._defaultConfig.id;

  @Input()
  panelClass = this._defaultConfig.panelClass;

  @Input()
  scrollStrategy = this._defaultConfig.scrollStrategy;

  @Input()
  viewContainerRef = this._defaultConfig.viewContainerRef;

  constructor(private _bottomSheetService: BottomSheetService) {}

  showBottomSheet() {
    this._bottomSheetService.open(BottomSheetStorybookComponent, {
      disableClose: this.disableClose,
      hasBackdrop: this.hasBackdrop,
      restoreFocus: this.restoreFocus,
      ariaLabel: this.ariaLabel,
      autoFocus: this.autoFocus,
      backdropClass: this.backdropClass,
      closeOnNavigation: this.closeOnNavigation,
      data: this.data,
      direction: this.direction,
      delayFocusTrap: this.delayFocusTrap,
      enterAnimationDuration: this.enterAnimationDuration,
      exitAnimationDuration: this.exitAnimationDuration,
      id: this.id,
      panelClass: this.panelClass,
      scrollStrategy: this.scrollStrategy,
      viewContainerRef: this.viewContainerRef,
    });
  }
}
