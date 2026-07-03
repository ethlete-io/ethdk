import { createSwipeTracker } from './swipe';

const mouseEvent = (clientX: number, clientY: number) => new MouseEvent('mousemove', { clientX, clientY });

const touchEvent = (clientX: number, clientY: number) => {
  const touch = { clientX, clientY } as Touch;

  return {
    type: 'touchmove',
    targetTouches: [touch],
    changedTouches: [touch],
  } as unknown as TouchEvent;
};

describe('createSwipeTracker', () => {
  it('should track movement relative to the start event', () => {
    const tracker = createSwipeTracker(mouseEvent(100, 200));
    const update = tracker.update(mouseEvent(150, 180));

    expect(update.originClientX).toBe(100);
    expect(update.originClientY).toBe(200);
    expect(update.movementX).toBe(50);
    expect(update.movementY).toBe(-20);
    expect(update.positiveMovementX).toBe(50);
    expect(update.positiveMovementY).toBe(20);
  });

  it('should classify horizontal movement as swiping', () => {
    const tracker = createSwipeTracker(mouseEvent(0, 0));
    const update = tracker.update(mouseEvent(30, 10));

    expect(update.isSwiping).toBe(true);
    expect(update.isScrolling).toBe(false);
  });

  it('should classify vertical movement as scrolling', () => {
    const tracker = createSwipeTracker(mouseEvent(0, 0));
    const update = tracker.update(mouseEvent(10, 30));

    expect(update.isSwiping).toBe(false);
    expect(update.isScrolling).toBe(true);
  });

  it('should keep the initial classification on later updates', () => {
    const tracker = createSwipeTracker(mouseEvent(0, 0));
    tracker.update(mouseEvent(10, 30));
    const update = tracker.update(mouseEvent(50, 31));

    expect(update.isSwiping).toBe(false);
    expect(update.isScrolling).toBe(true);
  });

  it('should read coordinates from touch events', () => {
    const tracker = createSwipeTracker(touchEvent(10, 20));
    const update = tracker.update(touchEvent(40, 25));

    expect(update.movementX).toBe(30);
    expect(update.movementY).toBe(5);
  });

  it('should report velocity and movement on end', () => {
    vi.useFakeTimers();

    const tracker = createSwipeTracker(mouseEvent(0, 0));
    vi.advanceTimersByTime(100);
    tracker.update(mouseEvent(-100, 50));
    const end = tracker.end();

    expect(end.movementX).toBe(-100);
    expect(end.movementY).toBe(50);
    expect(end.positiveMovementX).toBe(100);
    expect(end.pixelPerSecondX).toBe(-1000);
    expect(end.positivePixelPerSecondX).toBe(1000);
    expect(end.pixelPerSecondY).toBe(500);

    vi.useRealTimers();
  });

  it('should reset movement on cancel', () => {
    const tracker = createSwipeTracker(mouseEvent(0, 0));
    tracker.update(mouseEvent(100, 0));
    tracker.cancel();
    const end = tracker.end();

    expect(end.movementX).toBe(0);
    expect(end.movementY).toBe(0);
  });
});
