import { Directive, ElementRef, HostBinding, inject, Input, OnInit } from '@angular/core';
import { BottomSheetService } from '../../services';
import { BottomSheetRef, getClosestBottomSheet } from '../../utils';

let bottomSheetElementUid = 0;

@Directive({
  selector: '[et-bottom-sheet-title], [etBottomSheetTitle]',
  exportAs: 'etBottomSheetTitle',
  standalone: true,
})
export class BottomSheetTitleDirective implements OnInit {
  private _bottomSheetRef = inject(BottomSheetRef, { optional: true });
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _bottomSheetService = inject(BottomSheetService);

  @Input()
  @HostBinding('attr.id')
  id = `et-bottom-sheet-title-${bottomSheetElementUid++}`;

  ngOnInit() {
    if (!this._bottomSheetRef) {
      const closestRef = getClosestBottomSheet(this._elementRef, this._bottomSheetService.openBottomSheets);

      if (!closestRef) {
        throw Error('No closest ref found');
      }

      this._bottomSheetRef = closestRef;
    }

    Promise.resolve().then(() => this._bottomSheetRef?._containerInstance?._ariaLabelledByQueue?.push(this.id));
  }
}
