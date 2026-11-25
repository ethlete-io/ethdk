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

const channelsOf = (css: string, selector: string, name: string) => {
  const body = new RegExp(`\\n  ${selector.replace('.', '\\.')} \\{([^}]*)\\}`, 'u').exec(css)?.[1] ?? '';
  const match = new RegExp(`${name}: (\\d+ \\d+ \\d+);`, 'u').exec(body);

  return match?.[1]?.split(' ').map(Number) ?? [];
};

const luminanceOf = (rgb: number[]) => {
  const [r = 0, g = 0, b = 0] = rgb.map((channel) => {
    const c = channel / 255;

    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const ratioOf = (a: number[], b: number[]) => {
  const [high = 0, low = 0] = [luminanceOf(a), luminanceOf(b)].sort((x, y) => y - x);

  return (high + 0.05) / (low + 0.05);
};

describe('colors skeleton semantic colour themes', () => {
  // Client run 2026-11-24-1751 started tomflix with --colors dark --accent #2dd4cc; its delete button stayed teal.
  it('registers an error and a warning theme by type on the dark tomflix foundation of client run 1751, each state AA', () => {
    const css = darkCss();

    for (const type of ['error', 'warning']) {
      const theme = `.et-color--${type}`;
      const fill = (state: string) => channelsOf(css, theme, `--et-color-primary${state}`);
      const on = (state: string) => channelsOf(css, theme, `--et-color-on-primary${state}`);
      const ink = (state: string) => channelsOf(css, theme, `--et-color-primary-ink${state}`);

      expect(css).toMatch(new RegExp(`\\${theme} \\{\\s*--et-color-theme-type: ${type};`, 'u'));
      expect(fill('')).not.toEqual([45, 212, 204]);
      expect(fill('-focus')).toEqual(fill('-hover'));
      expect(ink('-focus')).toEqual(ink('-hover'));
      expect(new Set(['', '-hover', '-active', '-disabled'].map((state) => fill(state).join(' '))).size).toBe(4);
      expect(on('-disabled')).not.toEqual(on(''));

      for (const state of ['', '-hover', '-focus', '-active']) {
        expect(ratioOf(on(state), fill(state))).toBeGreaterThanOrEqual(4.5);
        expect(ratioOf(ink(state), [0, 0, 0])).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('gives each theme its ink on both surfaces when the foundation starts both', () => {
    const css = colorsSkeletonOf({ scheme: 'both', accent: TOMFLIX_ACCENT }).files['colors.css'] ?? '';

    for (const type of ['error', 'warning']) {
      const light = channelsOf(css, `.et-color--${type}`, '--et-color-primary-ink');
      const dark = /@media \(prefers-color-scheme: dark\) \{\s*\.et-color--[a-z]+ \{/u.test(css)
        ? (new RegExp(
            `\\.et-surface--dark \\.et-color--${type},\\s*\\.et-surface--dark\\.et-color--${type} \\{\\s*--et-color-primary-ink: (\\d+ \\d+ \\d+);`,
            'u',
          )
            .exec(css)?.[1]
            ?.split(' ')
            .map(Number) ?? [])
        : [];

      expect(ratioOf(light, [255, 255, 255])).toBeGreaterThanOrEqual(4.5);
      expect(ratioOf(dark, [0, 0, 0])).toBeGreaterThanOrEqual(4.5);
    }
  });
});
