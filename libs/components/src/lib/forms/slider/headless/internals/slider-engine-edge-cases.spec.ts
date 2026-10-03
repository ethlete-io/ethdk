import { resolveMarks, snapValueToStep, valueFromPointerPosition, valueToPercent } from './slider-engine';

describe('slider engine edge cases', () => {
  it('collapses an inverted or empty range onto min', () => {
    expect(snapValueToStep(50, { min: 10, max: 5, step: 1 })).toBe(10);
    expect(snapValueToStep(50, { min: 10, max: 10, step: 1 })).toBe(10);
    expect(valueToPercent(7, { min: 10, max: 5 })).toBe(0);
    expect(resolveMarks(true, { min: 10, max: 5, step: 1 })).toEqual([]);
  });

  it('resolves a pointer on an inverted range to min', () => {
    const value = valueFromPointerPosition({
      clientX: 50,
      clientY: 0,
      trackRect: { left: 0, top: 0, width: 100, height: 10 },
      rtl: false,
      orientation: 'horizontal',
      bounds: { min: 10, max: 5, step: 1 },
    });

    expect(value).toBe(10);
  });

  it('snaps onto a grid anchored at a fractional min without float noise', () => {
    expect(snapValueToStep(0.35, { min: 0.05, max: 1, step: 0.1 })).toBe(0.35);
    expect(snapValueToStep(0.36, { min: 0.05, max: 1, step: 0.1 })).toBe(0.35);
    expect(snapValueToStep(0.7, { min: 0, max: 1, step: 0.1 })).toBe(0.7);
    expect(snapValueToStep(-0.35, { min: -1, max: 1, step: 0.1 })).toBe(-0.3);
  });

  it('keeps the precision of a step written in exponent notation', () => {
    expect(snapValueToStep(1.5e-7, { min: 0, max: 1e-6, step: 1.5e-7 })).toBe(1.5e-7);
    expect(snapValueToStep(3e-7, { min: 0, max: 1e-6, step: 1.5e-7 })).toBe(3e-7);
  });

  it('clamps to an off-grid max instead of overshooting it', () => {
    expect(snapValueToStep(10, { min: 0, max: 10, step: 3 })).toBe(9);
    expect(snapValueToStep(10, { min: 0, max: 10, step: 3, direction: 'up' })).toBe(10);
    expect(snapValueToStep(-5, { min: 0, max: 10, step: 3, direction: 'down' })).toBe(0);
  });
});
