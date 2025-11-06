import { Injectable } from '@angular/core';
import { SwipeEndEvent, SwipeUpdateEvent } from '../types';

let nextUniqueId = 0;

const isTouchEvent = (event: Event): event is TouchEvent => {
  return event.type[0] === 't';
};

@Injectable({
  providedIn: 'root',
})
export class SwipeHandlerService {
  private _handlerMap: Record<number, SwipeUpdateEvent> = {};

  startSwipe(event: TouchEvent | MouseEvent) {
    const handlerId = nextUniqueId++;

    const originClientX = isTouchEvent(event) ? event.targetTouches[0]!.clientX : event.clientX;
    const originClientY = isTouchEvent(event) ? event.targetTouches[0]!.clientY : event.clientY;
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

  updateSwipe(handlerId: number, event: TouchEvent | MouseEvent) {
    const handler = this._getSwipeHandler(handlerId);

    if (!handler) return null;

    const { originClientX, originClientY, isSwiping, isScrolling } = handler;

    const currentClientX = isTouchEvent(event) ? event.targetTouches[0]!.clientX : event.clientX;
    const currentClientY = isTouchEvent(event) ? event.targetTouches[0]!.clientY : event.clientY;

    const movementX = (originClientX - currentClientX) * -1;
    const movementY = (originClientY - currentClientY) * -1;

    const positiveMovementX = Math.abs(movementX);
    const positiveMovementY = Math.abs(movementY);

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
    const handler = this._getSwipeHandler(handlerId);

    if (!handler) return null;

    const { movementX, movementY, timestamp, originClientX, originClientY, positiveMovementX, positiveMovementY } =
      handler;

    const timestampStart = timestamp;
    const timestampEnd = Date.now();

    const swipeTime = timestampEnd - timestampStart;

    const pixelPerMillisecondX = movementX ? movementX / swipeTime : 0;
    const pixelPerSecondX = pixelPerMillisecondX * 1000;
    const positivePixelPerSecondX = Math.abs(pixelPerSecondX);

    const pixelPerMillisecondY = movementY ? movementY / swipeTime : 0;
    const pixelPerSecondY = pixelPerMillisecondY * 1000;
    const positivePixelPerSecondY = Math.abs(pixelPerSecondY);

    delete this._handlerMap[handlerId];

    const swipeEnd: SwipeEndEvent = {
      positivePixelPerSecondX,
      positivePixelPerSecondY,
      pixelPerSecondX,
      pixelPerSecondY,
      movementX,
      movementY,
      originClientX,
      originClientY,
      positiveMovementX,
      positiveMovementY,
    };

    return swipeEnd;
  }

  cancelSwipe(handlerId: number) {
    delete this._handlerMap[handlerId];
  }

  private _getSwipeHandler(handlerId: number) {
    const handler = this._handlerMap[handlerId];

    if (!handler) {
      return null;
    }

    return handler;
  }
}
