import { NgIf } from '@angular/common';
import { Component, Input } from '@angular/core';
import { DialogModule } from '../../dialog.module';
import { DialogService } from '../../services';
import { DialogConfig } from '../../utils';
import { DialogStorybookComponent } from './dialog.storybook.component';

@Component({
  selector: 'et-sb-dialog-host',
  template: `
    <button (click)="showDialog()" type="button">Show dialog</button> <br />
    <br />
    <button (click)="toggleScrollable()" type="button">Toggle scrollable</button> <br />
    <div *ngIf="_isScrollable" style="background:#171717; height:200vh; margin-top: 2rem"></div>
  `,
  standalone: true,
  imports: [DialogModule, NgIf],
})
export class DialogHostStorybookComponent {
  private _defaultConfig = new DialogConfig();

  @Input()
  ariaDescribedBy = this._defaultConfig.ariaDescribedBy;

  @Input()
  ariaLabel = this._defaultConfig.ariaLabel;

  @Input()
  ariaLabelledBy = this._defaultConfig.ariaLabelledBy;

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
  height = this._defaultConfig.height;

  @Input()
  id = this._defaultConfig.id;

  @Input()
  injector = this._defaultConfig.injector;

  @Input()
  maxHeight = this._defaultConfig.maxHeight;

  @Input()
  maxWidth = this._defaultConfig.maxWidth;

  @Input()
  minHeight = this._defaultConfig.minHeight;

  @Input()
  minWidth = this._defaultConfig.minWidth;

  @Input()
  panelClass = this._defaultConfig.panelClass;

  @Input()
  position = this._defaultConfig.position;

  @Input()
  restoreFocus = this._defaultConfig.restoreFocus;

  @Input()
  role = this._defaultConfig.role;

  @Input()
  scrollStrategy = this._defaultConfig.scrollStrategy;

  @Input()
  viewContainerRef = this._defaultConfig.viewContainerRef;

  @Input()
  width = this._defaultConfig.width;

  _isScrollable = false;

  constructor(private _dialogService: DialogService) {}

  toggleScrollable() {
    this._isScrollable = !this._isScrollable;
  }

  showDialog() {
    this._dialogService.open(DialogStorybookComponent, this);
  }
}
