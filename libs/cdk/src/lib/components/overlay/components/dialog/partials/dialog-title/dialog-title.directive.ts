import { Directive, ElementRef, HostBinding, inject, OnInit, input } from '@angular/core';
import { DialogService } from '../../services';
import { DialogRef, getClosestDialog } from '../../utils';

let dialogElementUid = 0;

/**
 * @deprecated Will be removed in v5.
 */
@Directive({
  selector: '[et-dialog-title], [etDialogTitle]',
  exportAs: 'etDialogTitle',
})
export class DialogTitleDirective implements OnInit {
  private _dialogRef = inject(DialogRef, { optional: true });
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _dialogService = inject(DialogService);

  @HostBinding('attr.id')
  readonly id = input(`et-dialog-title-${dialogElementUid++}`);

  ngOnInit() {
    if (!this._dialogRef) {
      const closestRef = getClosestDialog(this._elementRef, this._dialogService.openDialogs);

      if (!closestRef) {
        throw Error('No closest ref found');
      }

      this._dialogRef = closestRef;
    }

    Promise.resolve().then(() => this._dialogRef?._containerInstance?._ariaLabelledByQueue?.push(this.id()));
  }
}
