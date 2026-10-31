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

/** Resolves the theme's active ink tone (`--et-color-primary-ink-active` and its fallbacks) inside `scope`. */
export function themeInkActiveIn(scope: Locator): Promise<string> {
  return resolveBorderColorIn(
    scope,
    'rgb(var(--et-color-primary-ink-active, var(--et-color-primary-ink-focus, var(--et-color-primary-ink-hover, var(--et-color-primary-ink, var(--et-color-primary-active, var(--et-color-primary-focus, var(--et-color-primary-hover, var(--et-color-primary)))))))))',
  );
}
