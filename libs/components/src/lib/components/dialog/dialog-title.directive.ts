import { Directive, ElementRef, HostBinding, Input, OnInit, Optional } from '@angular/core';
import { DialogService } from './dialog.service';
import { DialogRef } from './dialog-ref';
import { getClosestDialog } from './dialog.utils';

let dialogElementUid = 0;

@Directive({
  selector: '[et-dialog-title], [etDialogTitle]',
  exportAs: 'etDialogTitle',
  standalone: true,
})
export class DialogTitleDirective implements OnInit {
  @Input()
  @HostBinding('attr.id')
  id = `et-dialog-title-${dialogElementUid++}`;

  constructor(
    @Optional() private _dialogRef: DialogRef<unknown>,
    private _elementRef: ElementRef<HTMLElement>,
    private _dialog: DialogService,
  ) {}

  ngOnInit() {
    if (!this._dialogRef) {
      const closestRef = getClosestDialog(this._elementRef, this._dialog.openDialogs);

      if (!closestRef) {
        throw Error('No closest ref found');
      }

      this._dialogRef = closestRef;
    }

    if (this._dialogRef) {
      Promise.resolve().then(() => {
        const container = this._dialogRef._containerInstance;

        if (container && !container._ariaLabelledBy) {
          container._ariaLabelledBy = this.id;
        }
      });
    }
  }
}
