import {
  Directive,
  ElementRef,
  HostBinding,
  HostListener,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
  inject,
} from '@angular/core';
import { DialogService } from '../../services';
import { DialogRef, getClosestDialog } from '../../utils';

/**
 * @deprecated Will be removed in v5.
 */
@Directive({
  selector: '[et-dialog-close], [etDialogClose]',
  exportAs: 'etDialogClose',
  host: {
    '[attr.aria-label]': 'ariaLabel || null',
  },
  standalone: true,
})
export class DialogCloseDirective implements OnInit, OnChanges {
  private _dialogRef = inject(DialogRef, { optional: true });
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _dialogService = inject(DialogService);

  @Input('aria-label')
  ariaLabel?: string;

  @Input()
  @HostBinding('attr.type')
  type: 'submit' | 'button' | 'reset' = 'button';

  @Input('et-dialog-close')
  dialogResult: unknown;

  @Input('etDialogClose')
  _etDialogClose: unknown;

  ngOnInit() {
    if (!this._dialogRef) {
      const closestRef = getClosestDialog(this._elementRef, this._dialogService.openDialogs);

      if (!closestRef) {
        throw Error('No closest ref found');
      }

      this._dialogRef = closestRef;
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
    if (!this._dialogRef) {
      return;
    }

    this._dialogRef._closeDialogVia(
      this._dialogRef,
      event.screenX === 0 && event.screenY === 0 ? 'keyboard' : 'mouse',
      this.dialogResult,
    );
  }
}
