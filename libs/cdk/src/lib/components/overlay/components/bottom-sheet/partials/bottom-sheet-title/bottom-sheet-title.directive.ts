import { Directive, ElementRef, HostBinding, inject, OnInit, input } from '@angular/core';
import { BottomSheetService } from '../../services';
import { BottomSheetRef, getClosestBottomSheet } from '../../utils';

let bottomSheetElementUid = 0;

/**
 * @deprecated Will be removed in v5.
 */
@Directive({
  selector: '[et-bottom-sheet-title], [etBottomSheetTitle]',
  exportAs: 'etBottomSheetTitle',
})
export class BottomSheetTitleDirective implements OnInit {
  private _bottomSheetRef = inject(BottomSheetRef, { optional: true });
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _bottomSheetService = inject(BottomSheetService);

  @HostBinding('attr.id')
  readonly id = input(`et-bottom-sheet-title-${bottomSheetElementUid++}`);

  ngOnInit() {
    if (!this._bottomSheetRef) {
      const closestRef = getClosestBottomSheet(this._elementRef, this._bottomSheetService.openBottomSheets);

      if (!closestRef) {
        throw Error('No closest ref found');
      }

      this._bottomSheetRef = closestRef;
    }

    Promise.resolve().then(() => this._bottomSheetRef?._containerInstance?._ariaLabelledByQueue?.push(this.id()));
  }
}
