import {
  adjacentMarkValue,
  constrainRangeThumb,
  nearestThumbIndex,
  resolveMarks,
  snapValueToMarks,
  snapValueToStep,
  toMarkStops,
  valueFromPointerPosition,
  valueToPercent,
} from './slider-engine';

describe('slider-engine', () => {
  describe('snapValueToStep', () => {
    it('clamps into the bounds', () => {
      expect(snapValueToStep(-10, { min: 0, max: 100, step: 1 })).toBe(0);
      expect(snapValueToStep(150, { min: 0, max: 100, step: 1 })).toBe(100);
    });

    it('snaps onto the step grid anchored at min', () => {
      expect(snapValueToStep(37, { min: 0, max: 100, step: 10 })).toBe(40);
      expect(snapValueToStep(34.9, { min: 0, max: 100, step: 10 })).toBe(30);
      expect(snapValueToStep(7, { min: 5, max: 100, step: 10 })).toBe(5);
      expect(snapValueToStep(11, { min: 5, max: 100, step: 10 })).toBe(15);
    });

    it('produces no float noise for fractional steps', () => {
      expect(snapValueToStep(0.30000000000000004, { min: 0, max: 1, step: 0.1 })).toBe(0.3);
      expect(snapValueToStep(0.57, { min: 0, max: 1, step: 0.1 })).toBe(0.6);
    });

    it('collapses to min when the bounds are empty or inverted', () => {
      expect(snapValueToStep(5, { min: 10, max: 10, step: 1 })).toBe(10);
      expect(snapValueToStep(5, { min: 10, max: 0, step: 1 })).toBe(10);
    });

    it('never snaps beyond max even when max is off the step grid', () => {
      expect(snapValueToStep(99, { min: 0, max: 95, step: 10 })).toBe(95);
    });
  });

  describe('valueToPercent', () => {
    it('maps the bounds onto 0–100', () => {
      expect(valueToPercent(0, { min: 0, max: 200 })).toBe(0);
      expect(valueToPercent(50, { min: 0, max: 200 })).toBe(25);
      expect(valueToPercent(200, { min: 0, max: 200 })).toBe(100);
    });

    it('clamps out-of-bounds values and guards empty bounds', () => {
      expect(valueToPercent(-5, { min: 0, max: 100 })).toBe(0);
      expect(valueToPercent(120, { min: 0, max: 100 })).toBe(100);
      expect(valueToPercent(5, { min: 10, max: 10 })).toBe(0);
    });
  });

  describe('valueFromPointerPosition', () => {
    const trackRect = { left: 100, top: 50, width: 200, height: 200 };
    const base = {
      clientX: 0,
      clientY: 0,
      trackRect,
      rtl: false,
      orientation: 'horizontal' as const,
      bounds: { min: 0, max: 100, step: 1 },
    };

    it('resolves the snapped value under the pointer', () => {
      expect(valueFromPointerPosition({ ...base, clientX: 100 })).toBe(0);
      expect(valueFromPointerPosition({ ...base, clientX: 200 })).toBe(50);
      expect(valueFromPointerPosition({ ...base, clientX: 231, bounds: { min: 0, max: 100, step: 10 } })).toBe(70);
    });

    it('clamps pointer positions outside the track', () => {
      expect(valueFromPointerPosition({ ...base, clientX: 0 })).toBe(0);
      expect(valueFromPointerPosition({ ...base, clientX: 999 })).toBe(100);
    });

    it('mirrors the position in RTL', () => {
      expect(valueFromPointerPosition({ ...base, clientX: 100, rtl: true })).toBe(100);
      expect(valueFromPointerPosition({ ...base, clientX: 250, rtl: true })).toBe(25);
    });

    it('falls back to min for a zero-width track', () => {
      expect(
        valueFromPointerPosition({
          ...base,
          clientX: 50,
          trackRect: { left: 0, top: 0, width: 0, height: 0 },
          bounds: { min: 10, max: 100, step: 1 },
        }),
      ).toBe(10);
    });

    describe('vertical', () => {
      const vertical = { ...base, orientation: 'vertical' as const };

      it('runs bottom→up', () => {
        expect(valueFromPointerPosition({ ...vertical, clientY: 250 })).toBe(0);
        expect(valueFromPointerPosition({ ...vertical, clientY: 150 })).toBe(50);
        expect(valueFromPointerPosition({ ...vertical, clientY: 50 })).toBe(100);
      });

      it('clamps pointer positions outside the track and ignores the X axis', () => {
        expect(valueFromPointerPosition({ ...vertical, clientX: 9999, clientY: 999 })).toBe(0);
        expect(valueFromPointerPosition({ ...vertical, clientX: -9999, clientY: -999 })).toBe(100);
      });

      it('is not mirrored in RTL', () => {
        expect(valueFromPointerPosition({ ...vertical, clientY: 150, rtl: true })).toBe(50);
        expect(valueFromPointerPosition({ ...vertical, clientY: 250, rtl: true })).toBe(0);
      });

      it('falls back to min for a zero-height track', () => {
        expect(
          valueFromPointerPosition({
            ...vertical,
            clientY: 50,
            trackRect: { left: 0, top: 0, width: 200, height: 0 },
            bounds: { min: 10, max: 100, step: 1 },
          }),
        ).toBe(10);
      });
    });
  });

  describe('nearestThumbIndex', () => {
    it('picks the thumb closest to the target', () => {
      expect(nearestThumbIndex(10, [20, 80])).toBe(0);
      expect(nearestThumbIndex(70, [20, 80])).toBe(1);
    });

    it('tie-breaks coincident thumbs by drag direction', () => {
      expect(nearestThumbIndex(60, [50, 50])).toBe(1);
      expect(nearestThumbIndex(40, [50, 50])).toBe(0);
    });

    it('picks the earlier thumb for the exact midpoint', () => {
      expect(nearestThumbIndex(50, [40, 60])).toBe(0);
    });
  });

  describe('constrainRangeThumb', () => {
    it('keeps the start thumb below the end thumb minus the distance', () => {
      expect(constrainRangeThumb(70, { end: 'start', otherValue: 60, minDistance: 10 })).toBe(50);
      expect(constrainRangeThumb(30, { end: 'start', otherValue: 60, minDistance: 10 })).toBe(30);
    });

    it('keeps the end thumb above the start thumb plus the distance', () => {
      expect(constrainRangeThumb(10, { end: 'end', otherValue: 40, minDistance: 10 })).toBe(50);
      expect(constrainRangeThumb(80, { end: 'end', otherValue: 40, minDistance: 10 })).toBe(80);
    });

    it('lets thumbs touch when no distance is required', () => {
      expect(constrainRangeThumb(60, { end: 'start', otherValue: 60, minDistance: 0 })).toBe(60);
    });
  });

  describe('resolveMarks', () => {
    it('is empty when marks are off or the bounds are empty', () => {
      expect(resolveMarks(false, { min: 0, max: 100, step: 10 })).toEqual([]);
      expect(resolveMarks(true, { min: 10, max: 10, step: 1 })).toEqual([]);
      expect(resolveMarks(true, { min: 0, max: 100, step: 0 })).toEqual([]);
    });

    it('derives one tick per step from `true`', () => {
      expect(resolveMarks(true, { min: 0, max: 100, step: 25 })).toEqual([
        { value: 0 },
        { value: 25 },
        { value: 50 },
        { value: 75 },
        { value: 100 },
      ]);
    });

    it('still ticks a max that sits off the step grid', () => {
      expect(resolveMarks(true, { min: 0, max: 95, step: 50 })).toEqual([{ value: 0 }, { value: 50 }, { value: 95 }]);
    });

    it('throws in dev mode when `true` would generate too many ticks', () => {
      expect(() => resolveMarks(true, { min: 0, max: 100, step: 0.1 })).toThrow(/marks="true"/);
    });

    it('sorts, de-duplicates and drops out-of-bounds entries of an explicit list', () => {
      expect(
        resolveMarks([{ value: 80 }, { value: 200 }, { value: 20, label: 'Low' }, { value: 80, label: 'dupe' }], {
          min: 0,
          max: 100,
          step: 1,
        }),
      ).toEqual([{ value: 20, label: 'Low' }, { value: 80 }]);
    });
  });

  describe('toMarkStops', () => {
    const marks = [{ value: 0 }, { value: 50, label: 'Half' }, { value: 100 }];

    it('positions the marks and flags the ones inside the active range', () => {
      expect(toMarkStops(marks, { bounds: { min: 0, max: 200 }, activeRange: [0, 50] })).toEqual([
        { value: 0, percent: 0, active: true },
        { value: 50, label: 'Half', percent: 25, active: true },
        { value: 100, percent: 50, active: false },
      ]);
    });

    it('flags nothing without an active range', () => {
      expect(
        toMarkStops(marks, { bounds: { min: 0, max: 100 }, activeRange: null }).every((stop) => !stop.active),
      ).toBe(true);
    });
  });

  describe('snapValueToMarks', () => {
    const markValues = [0, 20, 80, 100];

    it('snaps to the nearest mark', () => {
      expect(snapValueToMarks(9, { markValues })).toBe(0);
      expect(snapValueToMarks(11, { markValues })).toBe(20);
      expect(snapValueToMarks(999, { markValues })).toBe(100);
    });

    it('restricts the result to marks below or above the value', () => {
      expect(snapValueToMarks(79, { markValues, direction: 'down' })).toBe(20);
      expect(snapValueToMarks(79, { markValues, direction: 'up' })).toBe(80);
      expect(snapValueToMarks(80, { markValues, direction: 'down' })).toBe(80);
      expect(snapValueToMarks(80, { markValues, direction: 'up' })).toBe(80);
    });

    it('falls back to the closest end when no mark satisfies the direction', () => {
      expect(snapValueToMarks(-5, { markValues, direction: 'down' })).toBe(0);
      expect(snapValueToMarks(150, { markValues, direction: 'up' })).toBe(100);
    });

    it('leaves the value alone when there are no marks', () => {
      expect(snapValueToMarks(42, { markValues: [] })).toBe(42);
    });
  });

  describe('adjacentMarkValue', () => {
    const markValues = [0, 20, 80, 100];

    it('moves whole marks and clamps at the ends', () => {
      expect(adjacentMarkValue(20, { markValues, steps: 1 })).toBe(80);
      expect(adjacentMarkValue(20, { markValues, steps: -1 })).toBe(0);
      expect(adjacentMarkValue(20, { markValues, steps: -10 })).toBe(0);
      expect(adjacentMarkValue(20, { markValues, steps: 10 })).toBe(100);
    });

    it('starts from the mark nearest the value', () => {
      expect(adjacentMarkValue(19, { markValues, steps: 1 })).toBe(80);
    });
  });
});
