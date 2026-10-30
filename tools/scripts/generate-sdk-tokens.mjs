import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';
import { format, resolveConfig } from 'prettier';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const optionOf = (name) => {
  const index = process.argv.indexOf(name);

  return index === -1 ? null : process.argv[index + 1];
};
const file = resolve(root, optionOf('--out') ?? '.ethlete/design/sdk/foundations/tokens/tokens.css');
const check = process.argv.includes('--check');

const jiti = createJiti(import.meta.url, { interopDefault: true });
const { themeCss } = await jiti.import(join(root, 'libs/core/design/theme-css.ts'));
const { BRAND_THEME, DANGER_THEME, WARNING_THEME } = await jiti.import(join(root, 'apps/storybook/src/themes.ts'));
const { LIGHT_SURFACE, DARK_SURFACE } = await jiti.import(join(root, 'apps/storybook/src/surface-themes.ts'));

const surfaceThemes = [LIGHT_SURFACE, DARK_SURFACE].map((theme) => ({ ...theme, isDefault: true }));
const colorThemes = [BRAND_THEME, DANGER_THEME, WARNING_THEME];

const SHADOW_COLOR = { light: '23 23 23', dark: '0 0 0' };

const withoutUtilityColors = (css) =>
  css
    .replace(/^:root \{\n[\s\S]*?\n\}\n/gm, '')
    .replace(/\n\s*\/\* Dynamic Tailwind[\s\S]*?\*\/\n/g, '\n')
    .replace(/^\s*--color-et-[^;]*;\n/gm, '');

const withShadowColor = (css) =>
  css.replace(
    /^(\s*)--et-surface-type: (light|dark);\n\s*--et-surface-elevation: [\d.]+;/gm,
    (match, indent, type) => `${match}\n${indent}--et-shadow-color-rgb: ${SHADOW_COLOR[type]};`,
  );

const BASE = `:root {
  --et-font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --et-font-family-mono: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 62.5%;
}

body {
  margin: 0;
  font-family: var(--et-font-family);
  font-size: 1.4rem;
  background: var(--et-surface-background-solid);
  color: var(--et-surface-color-solid);
}
`;

const header =
  '/* Generated from libs/core/design/theme-css.ts by tools/scripts/generate-sdk-tokens.mjs. Rerun: yarn sdk:tokens */';
const source = `${header}\n${withShadowColor(withoutUtilityColors(themeCss({ surfaceThemes, colorThemes })))}\n${BASE}`;
const formatted = await format(source, { ...(await resolveConfig(file)), filepath: file });

if (check) {
  const current = existsSync(file) ? readFileSync(file, 'utf8') : null;

  if (current !== formatted) {
    console.error(`Stale, run \`yarn sdk:tokens\`: ${file}`);
    process.exit(1);
  }
} else {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, formatted);
}
