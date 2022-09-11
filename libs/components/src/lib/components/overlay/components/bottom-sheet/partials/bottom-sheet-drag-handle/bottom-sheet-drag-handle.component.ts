import {
  OnInit,
  OnChanges,
  Input,
  HostBinding,
  Optional,
  ElementRef,
  SimpleChanges,
  HostListener,
  Component,
  ViewEncapsulation,
  ChangeDetectionStrategy,
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

  constructor(
    @Optional() public bottomSheetRef: BottomSheetRef<unknown>,
    private _elementRef: ElementRef<HTMLElement>,
    private _bottomSheetService: BottomSheetService,
    private _bottomSheetSwipeHandlerService: BottomSheetSwipeHandlerService,
  ) {}

  ngOnInit() {
    if (!this.bottomSheetRef) {
      const closestRef = getClosestBottomSheet(this._elementRef, this._bottomSheetService.openBottomSheets);

      if (!closestRef) {
        throw Error('No closest ref found');
      }

      this.bottomSheetRef = closestRef;
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
    this.bottomSheetRef._closeBottomSheetVia(
      this.bottomSheetRef,
      event.screenX === 0 && event.screenY === 0 ? 'keyboard' : 'mouse',
      this.bottomSheetResult,
    );
  }

  @HostListener('touchstart', ['$event'])
  _onTouchStart(event: TouchEvent) {
    this._swipeHandlerId = this._bottomSheetSwipeHandlerService.startSwipe(
      event,
      this.bottomSheetRef._containerInstance.elementRef.nativeElement,
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
      this.bottomSheetRef._closeBottomSheetVia(this.bottomSheetRef, 'touch', this.bottomSheetResult);
    }
  }
}
