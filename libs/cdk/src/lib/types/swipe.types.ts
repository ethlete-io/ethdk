export interface SwipeEnd {
  pixelPerSecondX: number;
  pixelPerSecondY: number;
  movementX: number;
  movementY: number;
  originClientX: number;
  originClientY: number;
}

export interface SwipeHandler {
  originClientX: number;
  originClientY: number;
  timestamp: number;
  movementX: number;
  movementY: number;
  positiveMovementX: number;
  positiveMovementY: number;
  isScrolling: boolean;
  isSwiping: boolean;
}
