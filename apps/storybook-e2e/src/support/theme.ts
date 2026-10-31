import { Locator } from '@playwright/test';

function resolveBorderColorIn(scope: Locator, value: string): Promise<string> {
  return scope.evaluate((host, borderColor) => {
    const probe = document.createElement('span');
    probe.style.border = `1px solid ${borderColor}`;
    host.appendChild(probe);
    const color = getComputedStyle(probe).borderTopColor;
    probe.remove();

    return color;
  }, value);
}

/** Resolves `--et-theme-color-primary-solid` inside `scope` to the colour a border would compute to. */
export function themePrimaryIn(scope: Locator): Promise<string> {
  return resolveBorderColorIn(scope, 'var(--et-theme-color-primary-solid)');
}

const INK_ACTIVE =
  'rgb(var(--et-color-primary-ink-active, var(--et-color-primary-ink-focus, var(--et-color-primary-ink-hover, var(--et-color-primary-ink, var(--et-color-primary-active, var(--et-color-primary-focus, var(--et-color-primary-hover, var(--et-color-primary)))))))))';

const PRIMARY_HOVER = 'rgb(var(--et-color-primary-hover, var(--et-color-primary)))';

export type ColorScheme = 'light' | 'dark';

/** Forces the page's `color-scheme`, so `light-dark()` resolves to the given side. */
export function setColorScheme(scope: Locator, scheme: ColorScheme): Promise<void> {
  return scope.evaluate((_, value) => {
    document.documentElement.style.colorScheme = value;
  }, scheme);
}

/** Resolves the error hover tone inside `scope`: the theme's primary hover tone in light, its active ink tone in dark. */
export function themeErrorHoverIn(scope: Locator, scheme: ColorScheme): Promise<string> {
  return resolveBorderColorIn(scope, scheme === 'light' ? PRIMARY_HOVER : INK_ACTIVE);
}

/** Resolves the error hover tone of `scheme` mixed with `percent`% into transparent inside `scope`. */
export function themeErrorHoverMixIn(scope: Locator, scheme: ColorScheme, percent: number): Promise<string> {
  const tone = scheme === 'light' ? PRIMARY_HOVER : INK_ACTIVE;

  return resolveBorderColorIn(scope, `color-mix(in srgb, ${tone} ${percent}%, transparent)`);
}

/** Resolves a colour expression (e.g. `var(--et-surface-color-solid)`) inside `scope` to the colour a border would compute to. */
export function colorIn(scope: Locator, value: string): Promise<string> {
  return resolveBorderColorIn(scope, value);
}

/**
 * The WCAG contrast ratio of a computed colour of `locator` (optionally of a pseudo-element)
 * against the page background, with any alpha composited onto that background first.
 */
export function contrastAgainstPage(
  locator: Locator,
  property: 'color' | 'borderTopColor' | 'outlineColor',
  pseudo?: string,
): Promise<number> {
  return locator.evaluate(
    (el, { property, pseudo }) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('no 2d canvas context');

      const paint = (fill: string) => {
        context.fillStyle = fill;
        context.fillRect(0, 0, 1, 1);
        return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
      };
      const luminance = (rgb: number[]) => {
        const [r = 0, g = 0, b = 0] = rgb.map((v) => {
          const c = v / 255;
          return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };

      const page = luminance(paint(getComputedStyle(document.documentElement).backgroundColor));
      const ink = luminance(paint(getComputedStyle(el, pseudo)[property]));

      return (Math.max(page, ink) + 0.05) / (Math.min(page, ink) + 0.05);
    },
    { property, pseudo },
  );
}
