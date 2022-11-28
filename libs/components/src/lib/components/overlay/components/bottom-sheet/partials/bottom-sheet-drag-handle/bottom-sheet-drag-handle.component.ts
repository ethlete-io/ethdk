import {
  OnInit,
  OnChanges,
  Input,
  HostBinding,
  ElementRef,
  SimpleChanges,
  HostListener,
  Component,
  ViewEncapsulation,
  ChangeDetectionStrategy,
  inject,
} from '@angular/core';
import { BottomSheetService, BottomSheetSwipeHandlerService } from '../../services';
import { BottomSheetRef, getClosestBottomSheet } from '../../utils';

@Component({
  selector: '[et-bottom-sheet-drag-handle], [etBottomSheetDragHandle]',
  template: '',
  styleUrls: ['./bottom-sheet-drag-handle.component.scss'],
  exportAs: 'etBottomSheetDragHandle',
  host: {
    class: 'et-bottom-sheet-drag-handle',
    '[attr.aria-label]': 'ariaLabel || null',
  },
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [BottomSheetSwipeHandlerService],
})
export class BottomSheetDragHandleComponent implements OnInit, OnChanges {
  private _bottomSheetRef = inject(BottomSheetRef, { optional: true });
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _bottomSheetService = inject(BottomSheetService);
  private readonly _bottomSheetSwipeHandlerService = inject(BottomSheetSwipeHandlerService);

  @Input('aria-label')
  ariaLabel?: string = 'Close sheet';

  @Input()
  @HostBinding('attr.type')
  type: 'submit' | 'button' | 'reset' = 'button';

  @Input('et-bottom-sheet-drag-handle')
  bottomSheetResult: unknown;

  @Input('etBottomSheetDragHandle')
  _etBottomSheetDragHandle: unknown;

  private _swipeHandlerId: number | null = null;

  ngOnInit() {
    if (!this._bottomSheetRef) {
      const closestRef = getClosestBottomSheet(this._elementRef, this._bottomSheetService.openBottomSheets);

      if (!closestRef) {
        throw Error('No closest ref found');
      }

      this._bottomSheetRef = closestRef;
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    const change = changes['_etBottomSheetDragHandle'];

    if (change) {
      this.bottomSheetResult = change.currentValue;
    }
  }

  @HostListener('click', ['$event'])
  _onButtonClick(event: MouseEvent) {
    if (!this._bottomSheetRef) {
      return;
    }

    this._bottomSheetRef._closeBottomSheetVia(
      this._bottomSheetRef,
      event.screenX === 0 && event.screenY === 0 ? 'keyboard' : 'mouse',
      this.bottomSheetResult,
    );
  }

  @HostListener('touchstart', ['$event'])
  _onTouchStart(event: TouchEvent) {
    if (!this._bottomSheetRef) {
      return;
    }

    this._swipeHandlerId = this._bottomSheetSwipeHandlerService.startSwipe(
      event,
      this._bottomSheetRef._containerInstance.elementRef.nativeElement,
    );
  }

  @HostListener('touchmove', ['$event'])
  _onTouchMove(event: TouchEvent) {
    if (!this._swipeHandlerId) {
      return;
    }

    const didSwipe = this._bottomSheetSwipeHandlerService.updateSwipe(this._swipeHandlerId, event);

    if (!didSwipe) {
      this._swipeHandlerId = null;
    }
  }

  @HostListener('touchend')
  _onTouchEnd() {
    if (!this._swipeHandlerId) {
      return;
    }

    const shouldClose = this._bottomSheetSwipeHandlerService.endSwipe(this._swipeHandlerId);
    this._swipeHandlerId = null;

    if (shouldClose) {
      if (!this._bottomSheetRef) {
        return;
      }

      this._bottomSheetRef._closeBottomSheetVia(this._bottomSheetRef, 'touch', this.bottomSheetResult);
    }
  }
}
