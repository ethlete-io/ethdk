import {
  Directive,
  ElementRef,
  HostBinding,
  HostListener,
  Input,
  OnChanges,
  OnInit,
  Optional,
  SimpleChanges,
} from '@angular/core';
import { DialogService } from './dialog';
import { DialogRef } from './dialog-ref';

let dialogElementUid = 0;

@Directive({
  selector: '[et-dialog-close], [etDialogClose]',
  exportAs: 'etDialogClose',
  host: {
    '[attr.aria-label]': 'ariaLabel || null',
  },
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

@Directive({
  selector: '[et-dialog-title], [etDialogTitle]',
  exportAs: 'etDialogTitle',
})
export class DialogTitleDirective implements OnInit {
  @Input()
  @HostBinding('attr.id')
  id = `mat-mdc-dialog-title-${dialogElementUid++}`;

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

/**
 * Finds the closest MatDialogRef to an element by looking at the DOM.
 * @param element Element relative to which to look for a dialog.
 * @param openDialogs References to the currently-open dialogs.
 */
function getClosestDialog(element: ElementRef<HTMLElement>, openDialogs: DialogRef<unknown>[]) {
  let parent: HTMLElement | null = element.nativeElement.parentElement;

  while (parent && !parent.classList.contains('mat-mdc-dialog-container')) {
    parent = parent.parentElement;
  }

  return parent ? openDialogs.find((dialog) => dialog.id === parent?.id) : null;
}
