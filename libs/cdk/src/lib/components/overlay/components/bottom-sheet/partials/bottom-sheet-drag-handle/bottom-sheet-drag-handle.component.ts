import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostBinding,
  HostListener,
  inject,
  input,
  OnChanges,
  OnInit,
  SimpleChanges,
  ViewEncapsulation,
} from '@angular/core';
import { createDestroy, setInputSignal } from '@ethlete/core';
import { fromEvent, takeUntil, tap } from 'rxjs';
import { BottomSheetService, BottomSheetSwipeHandlerService } from '../../services';
import { BottomSheetRef, getClosestBottomSheet } from '../../utils';

/**
 * @deprecated Will be removed in v5.
 */
@Component({
  selector: '[et-bottom-sheet-drag-handle], [etBottomSheetDragHandle]',
  template: '',
  styleUrls: ['./bottom-sheet-drag-handle.component.scss'],
  exportAs: 'etBottomSheetDragHandle',
  host: {
    class: 'et-bottom-sheet-drag-handle',
    '[attr.aria-label]': 'ariaLabel() || null',
  },
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [BottomSheetSwipeHandlerService],
})
export class BottomSheetDragHandleComponent implements OnInit, OnChanges {
  private _bottomSheetRef = inject(BottomSheetRef, { optional: true });
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _bottomSheetService = inject(BottomSheetService);
  private readonly _bottomSheetSwipeHandlerService = inject(BottomSheetSwipeHandlerService);
  private readonly _destroy$ = createDestroy();

  readonly ariaLabel = input<string | undefined>('Close sheet', { alias: 'aria-label' });

  @HostBinding('attr.type')
  readonly type = input<'submit' | 'button' | 'reset'>('button');

  readonly bottomSheetResult = input<unknown>(undefined, { alias: 'et-bottom-sheet-drag-handle' });

  readonly _etBottomSheetDragHandle = input<unknown>(undefined, { alias: 'etBottomSheetDragHandle' });

  private _swipeHandlerId: number | null = null;

  ngOnInit() {
    if (!this._bottomSheetRef) {
      const closestRef = getClosestBottomSheet(this._elementRef, this._bottomSheetService.openBottomSheets);

      if (!closestRef) {
        throw Error('No closest ref found');
      }

      this._bottomSheetRef = closestRef;
    }

    fromEvent<TouchEvent>(this._elementRef.nativeElement, 'touchstart', { passive: true })
      .pipe(
        tap((event) => this._onTouchStart(event)),
        takeUntil(this._destroy$),
      )
      .subscribe();

    fromEvent<TouchEvent>(this._elementRef.nativeElement, 'touchmove', { passive: true })
      .pipe(
        tap((event) => this._onTouchMove(event)),
        takeUntil(this._destroy$),
      )
      .subscribe();

    fromEvent<TouchEvent>(this._elementRef.nativeElement, 'touchend', { passive: true })
      .pipe(
        tap((event) => this._onTouchEnd(event)),
        takeUntil(this._destroy$),
      )
      .subscribe();
  }

  ngOnChanges(changes: SimpleChanges) {
    const change = changes['_etBottomSheetDragHandle'];

    if (change) {
      setInputSignal(this.bottomSheetResult, change.currentValue);
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
      this.bottomSheetResult(),
    );
  }

  _onTouchStart(event: TouchEvent) {
    if (!this._bottomSheetRef) {
      return;
    }

    if (event.cancelable) {
      event.preventDefault();
    }
    event.stopPropagation();

    this._swipeHandlerId = this._bottomSheetSwipeHandlerService.startSwipe(
      event,
      this._bottomSheetRef._containerInstance.elementRef.nativeElement,
    );
  }

  _onTouchMove(event: TouchEvent) {
    if (this._swipeHandlerId === null) {
      return;
    }

    if (event.cancelable) {
      event.preventDefault();
    }
    event.stopPropagation();

    const didSwipe = this._bottomSheetSwipeHandlerService.updateSwipe(this._swipeHandlerId, event);

    if (!didSwipe) {
      this._swipeHandlerId = null;
    }
  }

  _onTouchEnd(event: TouchEvent) {
    if (this._swipeHandlerId === null) {
      return;
    }

    event.stopPropagation();

    const shouldClose = this._bottomSheetSwipeHandlerService.endSwipe(this._swipeHandlerId);

    this._swipeHandlerId = null;

    if (shouldClose) {
      if (!this._bottomSheetRef) {
        return;
      }

      this._bottomSheetRef._closeBottomSheetVia(this._bottomSheetRef, 'touch', this.bottomSheetResult());
    }
  }
}
