import {
  constrainRangeThumb,
  nearestThumbIndex,
  snapValueToStep,
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
    const trackRect = { left: 100, width: 200 };

    it('resolves the snapped value under the pointer', () => {
      expect(
        valueFromPointerPosition({ clientX: 100, trackRect, rtl: false, bounds: { min: 0, max: 100, step: 1 } }),
      ).toBe(0);
      expect(
        valueFromPointerPosition({ clientX: 200, trackRect, rtl: false, bounds: { min: 0, max: 100, step: 1 } }),
      ).toBe(50);
      expect(
        valueFromPointerPosition({ clientX: 231, trackRect, rtl: false, bounds: { min: 0, max: 100, step: 10 } }),
      ).toBe(70);
    });

    it('clamps pointer positions outside the track', () => {
      expect(
        valueFromPointerPosition({ clientX: 0, trackRect, rtl: false, bounds: { min: 0, max: 100, step: 1 } }),
      ).toBe(0);
      expect(
        valueFromPointerPosition({ clientX: 999, trackRect, rtl: false, bounds: { min: 0, max: 100, step: 1 } }),
      ).toBe(100);
    });

    it('mirrors the position in RTL', () => {
      expect(
        valueFromPointerPosition({ clientX: 100, trackRect, rtl: true, bounds: { min: 0, max: 100, step: 1 } }),
      ).toBe(100);
      expect(
        valueFromPointerPosition({ clientX: 250, trackRect, rtl: true, bounds: { min: 0, max: 100, step: 1 } }),
      ).toBe(25);
    });

    it('falls back to min for a zero-width track', () => {
      expect(
        valueFromPointerPosition({
          clientX: 50,
          trackRect: { left: 0, width: 0 },
          rtl: false,
          bounds: { min: 10, max: 100, step: 1 },
        }),
      ).toBe(10);
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
});
