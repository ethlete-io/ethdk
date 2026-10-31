import { Locator } from '@playwright/test';

/** Resolves `--et-theme-color-primary-solid` inside `scope` to the colour a border would compute to. */
export function themePrimaryIn(scope: Locator): Promise<string> {
  return scope.evaluate((host) => {
    const probe = document.createElement('span');
    probe.style.border = '1px solid var(--et-theme-color-primary-solid)';
    host.appendChild(probe);
    const color = getComputedStyle(probe).borderTopColor;
    probe.remove();

    return color;
  });
}
