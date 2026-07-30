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

  describe('release velocity', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('should report the trailing flick, not the whole-gesture average', () => {
      const tracker = createSwipeTracker(mouseEvent(0, 0));

      // 20px over 900ms of slow dragging — an average of ~22px/s...
      for (let i = 1; i <= 9; i++) {
        vi.advanceTimersByTime(100);
        tracker.update(mouseEvent(0, i * 2));
      }

      // ...then a 60px flick over the final 50ms.
      vi.advanceTimersByTime(50);
      tracker.update(mouseEvent(0, 78));

      expect(tracker.end().pixelPerSecondY).toBeCloseTo(1200, 0);
    });

    it('should report no velocity when the pointer is held still before release', () => {
      const tracker = createSwipeTracker(mouseEvent(0, 0));

      vi.advanceTimersByTime(50);
      tracker.update(mouseEvent(0, 200));

      // Stationary pointers emit no move events, so the flick falls out of the trailing window.
      vi.advanceTimersByTime(500);

      const end = tracker.end();

      expect(end.pixelPerSecondY).toBe(0);
      expect(end.movementY).toBe(200);
    });

    it('should report the reversal when the gesture changes direction at the end', () => {
      const tracker = createSwipeTracker(mouseEvent(0, 0));

      vi.advanceTimersByTime(200);
      tracker.update(mouseEvent(0, 100));
      vi.advanceTimersByTime(50);
      tracker.update(mouseEvent(0, 70));

      const end = tracker.end();

      expect(end.pixelPerSecondY).toBeCloseTo(-600, 0);
      expect(end.positivePixelPerSecondY).toBeCloseTo(600, 0);
      expect(end.movementY).toBe(70);
    });

    it('should report no velocity for a gesture that never moved', () => {
      const tracker = createSwipeTracker(mouseEvent(0, 0));

      expect(tracker.end().pixelPerSecondY).toBe(0);
    });
  });
});
