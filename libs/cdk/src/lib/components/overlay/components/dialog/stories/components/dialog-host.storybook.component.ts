import { Component, inject, Input } from '@angular/core';
import { DialogImports, provideDialog } from '../../dialog.imports';
import { DialogService } from '../../services';
import { createDialogConfig } from '../../utils';
import { DialogStorybookComponent } from './dialog.storybook.component';

@Component({
  selector: 'et-sb-dialog-host',
  template: `
    <button (click)="showDialog()" type="button">Show dialog</button> <br />
    <br />
    <button (click)="toggleScrollable()" type="button">Toggle scrollable</button> <br />
    @if (_isScrollable) {
      <div style="background:#171717; height:200vh; margin-top: 2rem"></div>
    }
  `,
  imports: [DialogImports],
  providers: [provideDialog()],
})
export class DialogHostStorybookComponent {
  private readonly _defaultConfig = createDialogConfig();
  private readonly _dialogService = inject(DialogService);

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
  overlayClass = this._defaultConfig.overlayClass;

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
  containerClass = this._defaultConfig.containerClass;

  @Input()
  customAnimated = this._defaultConfig.customAnimated;

  @Input()
  position = this._defaultConfig.position;

  @Input()
  restoreFocus = this._defaultConfig.restoreFocus;

  @Input()
  role = this._defaultConfig.role;

  @Input()
  scrollStrategy = this._defaultConfig.scrollStrategy;

  @Input()
  positionStrategy = this._defaultConfig.positionStrategy;

  @Input()
  viewContainerRef = this._defaultConfig.viewContainerRef;

  @Input()
  width = this._defaultConfig.width;

  _isScrollable = false;

  toggleScrollable() {
    this._isScrollable = !this._isScrollable;
  }

  showDialog() {
    this._dialogService.open(DialogStorybookComponent, this);
  }
}
