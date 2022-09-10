import { Injectable } from '@angular/core';
import { SwipeHandlerService } from '../../services';
import { BOTTOM_SHEET_MIN_SWIPE_TO_DELETE_LENGTH, BOTTOM_SHEET_MIN_VELOCITY_TO_DELETE } from './bottom-sheet.constants';

@Injectable({
  providedIn: 'root',
})
export class BottomSheetSwipeHandlerService {
  private _notificationElementMap: Record<string, HTMLElement> = {};

  constructor(private _swipeHandlerService: SwipeHandlerService) {}

  startNotificationSwipe(event: TouchEvent, element: HTMLElement) {
    const handlerId = this._swipeHandlerService.startSwipe(event);

    this._notificationElementMap[handlerId] = element;

    return handlerId;
  }

  updateNotificationSwipe(handlerId: number, event: TouchEvent) {
    const { movementY } = this._swipeHandlerService.updateSwipe(handlerId, event);
    const notificationElement = this._getNotificationSwipeElement(handlerId);

    event.preventDefault();

    notificationElement.style.transform = `translateY(${movementY < 0 ? 0 : movementY}px)`;

    return true;
  }

  endNotificationSwipe(handlerId: number) {
    const { movementY, pixelPerSecondX } = this._swipeHandlerService.endSwipe(handlerId);
    const notificationElement = this._getNotificationSwipeElement(handlerId);

    if (
      movementY > BOTTOM_SHEET_MIN_SWIPE_TO_DELETE_LENGTH ||
      movementY < -BOTTOM_SHEET_MIN_SWIPE_TO_DELETE_LENGTH ||
      pixelPerSecondX > BOTTOM_SHEET_MIN_VELOCITY_TO_DELETE
    ) {
      notificationElement.style.transform = `translateY(${movementY < 0 ? '-' : ''}100%)`;
      return true;
    }

    notificationElement.style.transform = '';

    return false;
  }

  private _getNotificationSwipeElement(handlerId: number) {
    const handler = this._notificationElementMap[handlerId];

    if (!handler) {
      throw new Error(`The notification swipe handler with id ${[handlerId]} was not found`);
    }

    return handler;
  }
}
