import {
  Directive,
  OnInit,
  OnChanges,
  Input,
  HostBinding,
  Optional,
  ElementRef,
  SimpleChanges,
  HostListener,
} from '@angular/core';
import { DialogService } from './dialog.service';
import { DialogRef } from './dialog-ref';
import { getClosestDialog } from './dialog.utils';

@Directive({
  selector: '[et-dialog-close], [etDialogClose]',
  exportAs: 'etDialogClose',
  host: {
    '[attr.aria-label]': 'ariaLabel || null',
  },
  standalone: true,
})
export class DialogCloseDirective implements OnInit, OnChanges {
  @Input('aria-label')
  ariaLabel?: string;

  @Input()
  @HostBinding('attr.type')
  type: 'submit' | 'button' | 'reset' = 'button';

  @Input('et-dialog-close')
  dialogResult: unknown;

  @Input('etDialogClose')
  _etDialogClose: unknown;

  constructor(
    @Optional() public dialogRef: DialogRef<unknown>,
    private _elementRef: ElementRef<HTMLElement>,
    private _dialog: DialogService,
  ) {}

  ngOnInit() {
    if (!this.dialogRef) {
      const closestRef = getClosestDialog(this._elementRef, this._dialog.openDialogs);

      if (!closestRef) {
        throw Error('No closest ref found');
      }

      this.dialogRef = closestRef;
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    const change = changes['_etDialogClose'];

    if (change) {
      this.dialogResult = change.currentValue;
    }
  }

  @HostListener('click', ['$event'])
  _onButtonClick(event: MouseEvent) {
    this.dialogRef._closeDialogVia(
      this.dialogRef,
      event.screenX === 0 && event.screenY === 0 ? 'keyboard' : 'mouse',
      this.dialogResult,
    );
  }
}
