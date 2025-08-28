import { UniqueSelectionDispatcher } from '@angular/cdk/collections';
import { Directive, inject, OnDestroy } from '@angular/core';
import { CdkMenuItem } from './menu-item';
import { CdkMenuItemSelectable } from './menu-item-selectable';

let nextId = 0;

/**
 * @deprecated Use the new menu instead
 */
@Directive({
  selector: '[cdkMenuItemRadio]',
  exportAs: 'cdkMenuItemRadio',
  standalone: true,
  host: {
    role: 'menuitemradio',
    '[class.cdk-menu-item-radio]': 'true',
  },
  providers: [
    { provide: CdkMenuItemSelectable, useExisting: CdkMenuItemRadio },
    { provide: CdkMenuItem, useExisting: CdkMenuItemSelectable },
  ],
})
export class CdkMenuItemRadio extends CdkMenuItemSelectable implements OnDestroy {
  private readonly _selectionDispatcher = inject(UniqueSelectionDispatcher);

  private _id = `${nextId++}`;

  private _removeDispatcherListener?: () => void;

  constructor() {
    super();
    this._registerDispatcherListener();
  }

  override ngOnDestroy() {
    super.ngOnDestroy();

    this._removeDispatcherListener?.();
  }

  override trigger(options?: { keepOpen: boolean }) {
    super.trigger(options);

    if (!this.disabled) {
      this._selectionDispatcher.notify(this._id, '');
    }
  }

  private _registerDispatcherListener() {
    this._removeDispatcherListener = this._selectionDispatcher.listen((id: string) => {
      this.checked = this._id === id;
    });
  }
}
