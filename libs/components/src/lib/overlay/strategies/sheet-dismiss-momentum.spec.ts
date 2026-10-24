import { dismissMomentumEasing } from './sheet-strategy-hooks';

const controlPointsOf = (easing: string) =>
  easing
    .replace(/cubic-bezier\(|\)/g, '')
    .split(',')
    .map(Number) as [number, number, number, number];

const startSlopeOf = (easing: string) => {
  const [x1, y1] = controlPointsOf(easing);

  return y1 / x1;
};

const endSlopeOf = (easing: string) => {
  const [, , x2, y2] = controlPointsOf(easing);

  return (1 - y2) / (1 - x2);
};

describe('dismissMomentumEasing', () => {
  it('starts the exit at the release speed when the duration matches the swipe', () => {
    const easing = dismissMomentumEasing({ speed: 1000, remainingDistance: 300 }, 300);

    expect(startSlopeOf(easing)).toBeCloseTo(1, 2);
  });

  it('starts a slow release slow when the duration is clamped to the maximum', () => {
    const easing = dismissMomentumEasing({ speed: 200, remainingDistance: 500 }, 350);

    expect(startSlopeOf(easing)).toBeCloseTo(0.14, 2);
  });

  it('caps the start slope so the curve does not overshoot the exit', () => {
    const easing = dismissMomentumEasing({ speed: 15000, remainingDistance: 300 }, 100);

    expect(startSlopeOf(easing)).toBeCloseTo(3, 1);
  });

  it('keeps a slow release accelerating until the sheet is gone', () => {
    const easing = dismissMomentumEasing({ speed: 200, remainingDistance: 500 }, 350);

    expect(endSlopeOf(easing)).toBeGreaterThan(startSlopeOf(easing));
  });

  it('runs a release at the exit speed out linearly', () => {
    const easing = dismissMomentumEasing({ speed: 1000, remainingDistance: 300 }, 300);

    expect(endSlopeOf(easing)).toBeCloseTo(1, 2);
  });
});
