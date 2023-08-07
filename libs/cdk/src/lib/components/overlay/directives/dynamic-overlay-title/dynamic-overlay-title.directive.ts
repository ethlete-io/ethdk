import { Directive, ElementRef, HostBinding, Input, OnInit, inject } from '@angular/core';
import {
  BottomSheetRef,
  BottomSheetService,
  DialogRef,
  DialogService,
  getClosestBottomSheet,
  getClosestDialog,
} from '../../components';

let overlayElementUid = 0;

@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: '[et-dynamic-overlay-title], [etDynamicOverlayTitle]',
  exportAs: 'etDynamicOverlayTitle',
  standalone: true,
  host: {
    class: 'et-dynamic-overlay-title',
  },
})
export class DynamicOverlayTitleDirective implements OnInit {
  private _overlayRef = inject(DialogRef, { optional: true }) ?? inject(BottomSheetRef);
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _overlayService = inject(DialogService, { optional: true }) ?? inject(BottomSheetService);

  @Input()
  @HostBinding('attr.id')
  id = `et-dynamic-overlay-title-${overlayElementUid++}`;

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

    if (this._overlayRef) {
      Promise.resolve().then(() => {
        if (!this._overlayRef) {
          return;
        }

        const container = this._overlayRef._containerInstance;

        if (container && !container._ariaLabelledBy) {
          container._ariaLabelledBy = this.id;
        }
      });
    }
  }
}
