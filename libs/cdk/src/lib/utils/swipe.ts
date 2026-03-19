import { SwipeEndEvent, SwipeUpdateEvent } from '../types';

export type SwipeTracker = {
  update(event: TouchEvent | MouseEvent): SwipeUpdateEvent;
  end(): SwipeEndEvent;
  cancel(): void;
};

const getClientXY = (event: TouchEvent | MouseEvent): { clientX: number; clientY: number } => {
  if (event.type[0] === 't') {
    const touch = (event as TouchEvent).targetTouches[0] ?? (event as TouchEvent).changedTouches[0];
    return touch ? { clientX: touch.clientX, clientY: touch.clientY } : { clientX: 0, clientY: 0 };
  }
  return { clientX: (event as MouseEvent).clientX, clientY: (event as MouseEvent).clientY };
};

export const createSwipeTracker = (startEvent: TouchEvent | MouseEvent): SwipeTracker => {
  const { clientX: originClientX, clientY: originClientY } = getClientXY(startEvent);
  const startTime = Date.now();

  let movementX = 0;
  let movementY = 0;
  let isSwiping = false;
  let isScrolling = false;

  const update = (event: TouchEvent | MouseEvent): SwipeUpdateEvent => {
    const { clientX, clientY } = getClientXY(event);
    movementX = clientX - originClientX;
    movementY = clientY - originClientY;

    const positiveMovementX = Math.abs(movementX);
    const positiveMovementY = Math.abs(movementY);

    if (!isSwiping && !isScrolling) {
      if (positiveMovementY > positiveMovementX) {
        isScrolling = true;
      } else {
        isSwiping = true;
      }
    }

    return {
      originClientX,
      originClientY,
      timestamp: startTime,
      movementX,
      movementY,
      positiveMovementX,
      positiveMovementY,
      isScrolling,
      isSwiping,
    };
  };

  const end = (): SwipeEndEvent => {
    const swipeTime = Math.max(1, Date.now() - startTime);
    const positiveMovementX = Math.abs(movementX);
    const positiveMovementY = Math.abs(movementY);
    const pixelPerSecondX = (movementX / swipeTime) * 1000;
    const pixelPerSecondY = (movementY / swipeTime) * 1000;

    return {
      movementX,
      movementY,
      positiveMovementX,
      positiveMovementY,
      pixelPerSecondX,
      pixelPerSecondY,
      positivePixelPerSecondX: Math.abs(pixelPerSecondX),
      positivePixelPerSecondY: Math.abs(pixelPerSecondY),
      originClientX,
      originClientY,
    };
  };

  const cancel = (): void => {
    movementX = 0;
    movementY = 0;
  };

  return { update, end, cancel };
};
