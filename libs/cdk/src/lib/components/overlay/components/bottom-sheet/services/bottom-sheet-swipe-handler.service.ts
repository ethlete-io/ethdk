import { inject, Injectable } from '@angular/core';
import { SwipeHandlerService } from '../../../../../services';
import { BOTTOM_SHEET_MIN_SWIPE_TO_CLOSE_LENGTH, BOTTOM_SHEET_MIN_VELOCITY_TO_CLOSE } from '../constants';

@Injectable()
export class BottomSheetSwipeHandlerService {
  private _swipeHandlerService = inject(SwipeHandlerService);
  private _elementMap: Record<number, HTMLElement> = {};

  startSwipe(event: TouchEvent, element: HTMLElement) {
    const handlerId = this._swipeHandlerService.startSwipe(event);

    this._elementMap[handlerId] = element;

    return handlerId;
  }

  updateSwipe(handlerId: number, event: TouchEvent) {
    const { movementY } = this._swipeHandlerService.updateSwipe(handlerId, event);
    const element = this._getSwipeElement(handlerId);

    element.style.setProperty('--touch-translate-y', `${movementY < 0 ? 0 : movementY}px`);

    return true;
  }

  endSwipe(handlerId: number) {
    const { movementY, pixelPerSecondY } = this._swipeHandlerService.endSwipe(handlerId);
    const element = this._getSwipeElement(handlerId);

    if (
      movementY > BOTTOM_SHEET_MIN_SWIPE_TO_CLOSE_LENGTH ||
      (pixelPerSecondY > BOTTOM_SHEET_MIN_VELOCITY_TO_CLOSE && movementY > 0)
    ) {
      return true;
    }

    element.style.transition = 'transform 100ms var(--ease-out-1)';
    element.style.removeProperty('--touch-translate-y');

    setTimeout(() => {
      element.style.transition = '';
    }, 100);

    return false;
  }

  private _getSwipeElement(handlerId: number) {
    const handler = this._elementMap[handlerId];

    if (!handler) {
      throw new Error(`The swipe handler with id ${handlerId} was not found`);
    }

    return handler;
  }
}
