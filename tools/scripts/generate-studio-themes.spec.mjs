import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const part = join(root, '.ethlete/design/studio/foundations/colors/colors.css');

test('a colour block added to the colours part becomes a theme in every generated stylesheet', () => {
  mkdirSync(join(root, 'tmp'), { recursive: true });
  const out = mkdtempSync(join(root, 'tmp/studio-themes-'));
  const fixture = join(out, 'colors.css');

  writeFileSync(
    fixture,
    `${readFileSync(part, 'utf8')}
:root {
  --success: oklch(0.7 0.15 150);
  --success-hover: oklch(0.75 0.15 150);
  --success-text: oklch(0.8 0.12 150);
  --on-success: oklch(0.18 0.04 150);
  --success-active: oklch(0.62 0.15 150);
  --success-disabled: oklch(0.38 0.06 150);
  --on-success-disabled: oklch(0.18 0.02 150);
}
`,
  );

  try {
    execFileSync(
      process.execPath,
      [join(root, 'tools/scripts/generate-studio-themes.mjs'), '--part', fixture, '--out', out],
      {
        cwd: root,
        stdio: 'pipe',
      },
    );

    const themes = readFileSync(join(out, 'apps/ethlete-studio/src/themes.ts'), 'utf8');
    const css = readFileSync(join(out, 'apps/ethlete-studio/src/styles/themes.css'), 'utf8');

    assert.match(themes, /export const SUCCESS_THEME: ColorTheme = {\s*name: 'success',\s*type: 'success',/);
    assert.match(themes, /THEMES = \[BRAND_THEME, DANGER_THEME, SUCCESS_THEME, WARNING_THEME\]/);
    assert.match(css, /--color-et-success:/);
    assert.match(css, /\.et-color--success {/);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
