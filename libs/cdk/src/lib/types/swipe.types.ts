export interface SwipeEndEvent {
  positivePixelPerSecondX: number;
  positivePixelPerSecondY: number;
  pixelPerSecondX: number;
  pixelPerSecondY: number;
  movementX: number;
  movementY: number;
  positiveMovementX: number;
  positiveMovementY: number;
  originClientX: number;
  originClientY: number;
}

export interface SwipeUpdateEvent {
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
