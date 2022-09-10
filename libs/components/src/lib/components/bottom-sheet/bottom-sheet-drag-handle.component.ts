import {
  Directive,
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
import { DialogRef } from '../dialog';
import { getClosestDialog } from '../dialog/dialog.utils';
import { BottomSheetSwipeHandlerService } from './bottom-sheet-swipe-handler.service';
import { BottomSheetService } from './bottom-sheet.service';

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
})
export class BottomSheetDragHandleComponent implements OnInit, OnChanges {
  @Input('aria-label')
  ariaLabel?: string = 'Close sheet';

  @Input()
  @HostBinding('attr.type')
  type: 'submit' | 'button' | 'reset' = 'button';

  @Input('et-bottom-sheet-drag-handle')
  dialogResult: unknown;

  @Input('etBottomSheetDragHandle')
  _etDialogClose: unknown;

  private _notificationSwipeHandlerId: number | null = null;

  constructor(
    @Optional() public dialogRef: DialogRef<unknown>,
    private _elementRef: ElementRef<HTMLElement>,
    private _dialog: BottomSheetService,
    private _bottomSheetSwipeHandlerService: BottomSheetSwipeHandlerService,
  ) {}

  ngOnInit() {
    if (!this.dialogRef) {
      const closestRef = getClosestDialog(this._elementRef, this._dialog.openDialogs);

      if (!closestRef) {
        throw Error('No closest ref found');
      }

      this.dialogRef = closestRef;
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    const change = changes['_etDialogClose'];

    if (change) {
      this.dialogResult = change.currentValue;
    }
  }

  @HostListener('click', ['$event'])
  _onButtonClick(event: MouseEvent) {
    this.dialogRef._closeDialogVia(
      this.dialogRef,
      event.screenX === 0 && event.screenY === 0 ? 'keyboard' : 'mouse',
      this.dialogResult,
    );
  }

  @HostListener('touchstart', ['$event'])
  _onTouchStart(event: TouchEvent) {
    this._notificationSwipeHandlerId = this._bottomSheetSwipeHandlerService.startNotificationSwipe(
      event,
      this.dialogRef._containerInstance.elementRef.nativeElement,
    );
  }

  @HostListener('touchmove', ['$event'])
  _onTouchMove(event: TouchEvent) {
    if (!this._notificationSwipeHandlerId) {
      return;
    }

    const didSwipe = this._bottomSheetSwipeHandlerService.updateNotificationSwipe(
      this._notificationSwipeHandlerId,
      event,
    );

    if (!didSwipe) {
      this._notificationSwipeHandlerId = null;
    }
  }

  @HostListener('touchend')
  _onTouchEnd() {
    if (!this._notificationSwipeHandlerId) {
      return;
    }

    const shouldRemoveNotification = this._bottomSheetSwipeHandlerService.endNotificationSwipe(
      this._notificationSwipeHandlerId,
    );
    this._notificationSwipeHandlerId = null;

    if (shouldRemoveNotification) {
      this.dialogRef._closeDialogVia(this.dialogRef, 'touch', this.dialogResult);
    }
  }
}
