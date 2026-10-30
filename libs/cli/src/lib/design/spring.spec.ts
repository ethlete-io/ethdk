import { describe, expect, it } from 'vitest';
import { spring } from '../../../design/spring';

const pointsOf = (easing: string) =>
  (/^linear\((.*)\)$/u.exec(easing)?.[1] ?? '').split(', ').map((point) => Number(point));

describe('spring', () => {
  it('samples a critically damped spring into a linear() easing that rises to 1 and lasts until it settles', () => {
    const { easing, duration } = spring({ damping: 1, frequency: 1 });
    const points = pointsOf(easing);

    expect(duration).toBe(1470);
    expect(points[0]).toBe(0);
    expect(points.at(-1)).toBe(1);
    expect(points.every((point, index) => index === 0 || point >= (points[index - 1] ?? 0))).toBe(true);
    expect(points[(points.length - 1) / 2]).toBeCloseTo(1 - Math.exp(-Math.PI * 1.47) * (1 + Math.PI * 1.47), 3);
  });

  it('overshoots below a damping of 1 and settles sooner at a higher frequency', () => {
    const loose = spring({ damping: 0.3, frequency: 2 });
    const quick = spring({ damping: 0.3, frequency: 4 });

    expect(Math.max(...pointsOf(loose.easing))).toBeCloseTo(1.37, 2);
    expect(quick.duration).toBeLessThan(loose.duration);
    expect(pointsOf(spring({ damping: 2, frequency: 1 }).easing).every((point) => point <= 1)).toBe(true);
  });

  it('reads as a duration and an easing in a CSS value, and refuses a damping or frequency of 0', () => {
    const value = spring({ damping: 0.7, frequency: 3 });

    expect(`${value}`).toBe(`${value.duration}ms ${value.easing}`);
    expect(() => spring({ damping: 0, frequency: 1 })).toThrow('above 0');
    expect(() => spring({ damping: 1, frequency: Number.NaN })).toThrow('above 0');
  });
});
