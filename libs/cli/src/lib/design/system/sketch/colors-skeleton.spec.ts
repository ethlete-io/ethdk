import { describe, expect, it } from 'vitest';
import { colorsSkeletonOf } from './colors-skeleton';

const TOMFLIX_ACCENT = '#2dd4cc';

const tokenOf = (css: string, name: string) => {
  const match = new RegExp(`${name}: (\\d+) (\\d+) (\\d+);`, 'u').exec(css);

  return match ? Number(match[1]) : NaN;
};

const darkCss = () => colorsSkeletonOf({ scheme: 'dark', accent: TOMFLIX_ACCENT }).files['colors.css'] ?? '';

describe('colors skeleton interaction states', () => {
  it('steps the surface tint on black as far as the SDK does and keeps hover, focus and active apart', () => {
    const css = darkCss();
    const [rest, hover, focus, active] = ['', '-hover', '-focus', '-active'].map((state) =>
      tokenOf(css, `--et-surface-interaction${state}`),
    );

    expect(rest).toBeLessThanOrEqual(160);
    expect((hover ?? 0) - (rest ?? 0)).toBeGreaterThanOrEqual(0.23 * 255);
    expect(new Set([rest, hover, focus, active]).size).toBe(4);
  });

  it('derives a distinct accent focus state', () => {
    const css = darkCss();
    const [hover, focus, active] = ['-hover', '-focus', '-active'].map((state) =>
      tokenOf(css, `--et-color-primary${state}`),
    );

    expect(focus).not.toBe(hover);
    expect(focus).not.toBe(active);
  });
});
