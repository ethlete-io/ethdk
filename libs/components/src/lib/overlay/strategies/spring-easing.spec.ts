import { springEasing } from './spring-easing';

const stopsOf = (easing: string) =>
  easing
    .replace(/^linear\(|\)$/g, '')
    .split(', ')
    .map((stop) => {
      const [value, at] = stop.split(' ');

      return { value: Number(value), at: Number(at?.replace('%', '')) / 100 };
    });

describe('springEasing', () => {
  it('runs a critically damped spring from rest to the target without overshoot', () => {
    const { easing, durationMs } = springEasing({ response: 0.4, dampingFraction: 1 });
    const stops = stopsOf(easing);

    expect(stops[0]).toEqual({ value: 0, at: 0 });
    expect(stops[stops.length - 1]).toEqual({ value: 1, at: 1 });
    expect(stops.every((stop, i) => stop.value >= (stops[i - 1]?.value ?? 0))).toBe(true);
    expect(Math.max(...stops.map((stop) => stop.value))).toBeLessThanOrEqual(1);
    expect(durationMs).toBeGreaterThan(300);
    expect(durationMs).toBeLessThan(800);
  });

  it('overshoots the target below full damping', () => {
    const { easing } = springEasing({ response: 0.4, dampingFraction: 0.6 });

    expect(Math.max(...stopsOf(easing).map((stop) => stop.value))).toBeGreaterThan(1.05);
  });

  it('starts at the given initial velocity', () => {
    const { easing, durationMs } = springEasing({ response: 0.4, dampingFraction: 1, initialVelocity: 5 });
    const second = stopsOf(easing)[1] ?? { value: 0, at: 1 };
    const slopePerSecond = second.value / ((second.at * durationMs) / 1000);

    expect(slopePerSecond).toBeGreaterThan(4);
    expect(slopePerSecond).toBeLessThan(5.5);
  });

  it('ends the first time it reaches the target when asked to', () => {
    const settled = springEasing({ response: 0.4, dampingFraction: 1, initialVelocity: 30 });
    const cut = springEasing({ response: 0.4, dampingFraction: 1, initialVelocity: 30, stopAtTarget: true });

    expect(cut.durationMs).toBeLessThan(settled.durationMs);
    expect(Math.max(...stopsOf(cut.easing).map((stop) => stop.value))).toBeLessThanOrEqual(1);
  });

  it('never runs longer than the max duration', () => {
    const { durationMs, easing } = springEasing({ response: 2, dampingFraction: 0.2, maxDurationMs: 500 });

    expect(durationMs).toBe(500);
    expect(stopsOf(easing).at(-1)).toEqual({ value: 1, at: 1 });
  });
});
