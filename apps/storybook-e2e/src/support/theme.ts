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

/** Resolves the theme's active ink tone (`--et-color-primary-ink-active` and its fallbacks) inside `scope`. */
export function themeInkActiveIn(scope: Locator): Promise<string> {
  return resolveBorderColorIn(scope, INK_ACTIVE);
}

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
