import { Injectable } from '@angular/core';
import { SwipeEnd, SwipeHandler } from '../types';

let nextUniqueId = 0;

@Injectable({
  providedIn: 'root',
})
export class SwipeHandlerService {
  private _handlerMap: Record<number, SwipeHandler> = {};

  startSwipe(event: TouchEvent) {
    const handlerId = nextUniqueId++;

    const originClientX = event.targetTouches[0].clientX;
    const originClientY = event.targetTouches[0].clientY;
    const timestamp = Date.now();

    this._handlerMap[handlerId] = {
      originClientX,
      originClientY,
      timestamp,
      movementX: 0,
      movementY: 0,
      positiveMovementX: 0,
      positiveMovementY: 0,
      isScrolling: false,
      isSwiping: false,
    };

    return handlerId;
  }

  updateSwipe(handlerId: number, event: TouchEvent) {
    const handler = this._getSwipeHandler(handlerId);
    const { originClientX, originClientY, isSwiping, isScrolling } = handler;

    const currentClientX = event.targetTouches[0].clientX;
    const currentClientY = event.targetTouches[0].clientY;

    const movementX = (originClientX - currentClientX) * -1;
    const movementY = (originClientY - currentClientY) * -1;

    const positiveMovementX = movementX < 0 ? movementX * -1 : movementX;
    const positiveMovementY = movementY < 0 ? movementY * -1 : movementY;

    if (!isSwiping && !isScrolling) {
      if (positiveMovementY > positiveMovementX) {
        handler.isScrolling = true;
      } else {
        handler.isSwiping = true;
      }
    }

    handler.movementX = movementX;
    handler.movementY = movementY;

    handler.positiveMovementX = positiveMovementX;
    handler.positiveMovementY = positiveMovementY;

    return handler;
  }

  endSwipe(handlerId: number) {
    const { movementX, movementY, timestamp, originClientX, originClientY, positiveMovementX, positiveMovementY } =
      this._getSwipeHandler(handlerId);

    const timestampStart = timestamp;
    const timestampEnd = Date.now();

    const swipeTime = timestampEnd - timestampStart;

    const pixelPerMillisecondX = positiveMovementX / swipeTime;
    const pixelPerSecondX = pixelPerMillisecondX * 1000;

    const pixelPerMillisecondY = positiveMovementY / swipeTime;
    const pixelPerSecondY = pixelPerMillisecondY * 1000;

    delete this._handlerMap[handlerId];

    const swipeEnd: SwipeEnd = {
      pixelPerSecondX,
      pixelPerSecondY,
      movementX,
      movementY,
      originClientX,
      originClientY,
    };

    return swipeEnd;
  }

  cancelSwipe(handlerId: number) {
    delete this._handlerMap[handlerId];
  }

  private _getSwipeHandler(handlerId: number) {
    const handler = this._handlerMap[handlerId];

    if (!handler) {
      throw new Error(`The swipe handler with id ${[handlerId]} was not found`);
    }

    return handler;
  }
}
