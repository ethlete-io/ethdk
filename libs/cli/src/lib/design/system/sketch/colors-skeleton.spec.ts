import { describe, expect, it } from 'vitest';
import { colorsSkeletonOf } from './colors-skeleton';

const TOMFLIX_ACCENT = '#2dd4cc';

const tokenOf = (css: string, name: string) => {
  const match = new RegExp(`${name}: (\\d+) (\\d+) (\\d+);`, 'u').exec(css);

  return match ? Number(match[1]) : NaN;
};

const darkCss = () => colorsSkeletonOf({ scheme: 'dark', accent: TOMFLIX_ACCENT }).files['colors.css'] ?? '';

describe('colors skeleton interaction states', () => {
  it('steps the surface tint on black as far as the SDK does', () => {
    const css = darkCss();
    const [rest, hover] = ['', '-hover'].map((state) => tokenOf(css, `--et-surface-interaction${state}`));

    expect(rest).toBeLessThanOrEqual(160);
    expect((hover ?? 0) - (rest ?? 0)).toBeGreaterThanOrEqual(0.23 * 255);
  });

  it('gives focus the hover value in surface and accent', () => {
    const css = darkCss();

    // The SDK uses one value for hover and focus.
    for (const name of ['--et-surface-interaction', '--et-color-primary', '--et-color-primary-ink'])
      expect(tokenOf(css, `${name}-focus`)).toBe(tokenOf(css, `${name}-hover`));
  });
});
