import { Directive, ElementRef, HostBinding, Input, OnInit, Optional } from '@angular/core';
import { BottomSheetService } from '../../services';
import { BottomSheetRef, getClosestBottomSheet } from '../../utils';

let bottomSheetElementUid = 0;

@Directive({
  selector: '[et-bottom-sheet-title], [etBottomSheetTitle]',
  exportAs: 'etBottomSheetTitle',
  standalone: true,
})
export class BottomSheetTitleDirective implements OnInit {
  @Input()
  @HostBinding('attr.id')
  id = `et-bottom-sheet-title-${bottomSheetElementUid++}`;

  constructor(
    @Optional() private _bottomSheetRef: BottomSheetRef<unknown>,
    private _elementRef: ElementRef<HTMLElement>,
    private _bottomSheetService: BottomSheetService,
  ) {}

  ngOnInit() {
    if (!this._bottomSheetRef) {
      const closestRef = getClosestBottomSheet(this._elementRef, this._bottomSheetService.openBottomSheets);

      if (!closestRef) {
        throw Error('No closest ref found');
      }

      this._bottomSheetRef = closestRef;
    }

    if (this._bottomSheetRef) {
      Promise.resolve().then(() => {
        const container = this._bottomSheetRef._containerInstance;

        if (container && !container._ariaLabelledBy) {
          container._ariaLabelledBy = this.id;
        }
      });
    }
  }
}
