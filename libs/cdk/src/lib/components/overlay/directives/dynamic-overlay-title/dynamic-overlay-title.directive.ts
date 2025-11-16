import { Directive, ElementRef, HostBinding, OnInit, inject, input } from '@angular/core';
import { BottomSheetService } from '../../components/bottom-sheet/services';
import { BottomSheetRef, getClosestBottomSheet } from '../../components/bottom-sheet/utils';
import { DialogService } from '../../components/dialog/services';
import { DialogRef, getClosestDialog } from '../../components/dialog/utils';

let overlayElementUid = 0;

/**
 * @deprecated Will be removed in v5.
 */
@Directive({
  selector: '[et-dynamic-overlay-title], [etDynamicOverlayTitle]',
  exportAs: 'etDynamicOverlayTitle',

  host: {
    class: 'et-dynamic-overlay-title',
  },
})
export class DynamicOverlayTitleDirective implements OnInit {
  private _overlayRef = inject(DialogRef, { optional: true }) ?? inject(BottomSheetRef);
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _overlayService = inject(DialogService, { optional: true }) ?? inject(BottomSheetService);

  @HostBinding('attr.id')
  readonly id = input(`et-dynamic-overlay-title-${overlayElementUid++}`);

  ngOnInit() {
    if (!this._overlayRef) {
      const closestRef =
        this._overlayService instanceof DialogService
          ? getClosestDialog(this._elementRef, this._overlayService.openDialogs)
          : getClosestBottomSheet(this._elementRef, this._overlayService.openBottomSheets);

      if (!closestRef) {
        throw Error('No closest ref found');
      }

      this._overlayRef = closestRef;
    }

    Promise.resolve().then(() => this._overlayRef?._containerInstance?._ariaLabelledByQueue?.push(this.id()));
  }
}
