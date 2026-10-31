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
const file = resolve(root, optionOf('--out') ?? '.ethlete/design/sdk/foundations/colors/colors.css');
const check = process.argv.includes('--check');
const overridesFile = optionOf('--overrides');
const overrides = overridesFile ? JSON.parse(readFileSync(resolve(root, overridesFile), 'utf8')) : {};

const jiti = createJiti(import.meta.url, { interopDefault: true });
const { themeCss } = await jiti.import(join(root, 'libs/core/design/theme-css.ts'));
const {
  BRAND_THEME,
  DANGER_THEME,
  WARNING_THEME,
  BRAND_ON_LIGHT_THEME,
  DANGER_ON_LIGHT_THEME,
  WARNING_ON_LIGHT_THEME,
  THEMES,
} = await jiti.import(join(root, 'apps/storybook/src/themes.ts'));
const { LIGHT_SURFACE, LIGHT_ELEVATED_SURFACE, DARK_SURFACE, DARK_ELEVATED_SURFACE } = await jiti.import(
  join(root, 'apps/storybook/src/surface-themes.ts'),
);

const themeNamed = (name) => {
  const theme = THEMES.find((candidate) => candidate.name === name);

  if (!theme) throw new Error(`Unknown colour theme in ${overridesFile}: ${name}`);

  return theme;
};

const withValues = (theme) => {
  const values = structuredClone(theme);

  for (const [path, value] of Object.entries(overrides.values?.[theme.name] ?? {})) {
    const keys = path.split('.');
    const parent = keys.slice(0, -1).reduce((node, key) => (node[key] ??= {}), values);

    parent[keys.at(-1)] = value;
  }

  return values;
};

const surfaceThemes = [
  ...[LIGHT_SURFACE, DARK_SURFACE].map((theme) => ({ ...withValues(theme), isDefault: true })),
  ...[LIGHT_ELEVATED_SURFACE, DARK_ELEVATED_SURFACE].map((theme) => ({ ...withValues(theme), isDefault: false })),
];
const defaultColorThemes = [
  BRAND_THEME,
  DANGER_THEME,
  WARNING_THEME,
  BRAND_ON_LIGHT_THEME,
  DANGER_ON_LIGHT_THEME,
  WARNING_ON_LIGHT_THEME,
];
const colorThemes = [
  ...defaultColorThemes,
  ...(overrides.extraColorThemes ?? []).map(themeNamed).filter((theme) => !defaultColorThemes.includes(theme)),
].map(withValues);
const unknownTargets = Object.keys(overrides.values ?? {}).filter(
  (name) => ![...surfaceThemes, ...colorThemes].some((theme) => theme.name === name),
);

if (unknownTargets.length) throw new Error(`Overrides name themes outside the set: ${unknownTargets.join(', ')}`);

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

const inkOf = (css, theme) => {
  const body = css.match(new RegExp(`\\.et-color--${theme}[ ,][\\s\\S]*?\\{\\n([\\s\\S]*?)\\n\\s*\\}`))?.[1];
  const ink = body?.match(/^\s*--et-color-primary-ink[^;]*;$/gm)?.map((line) => line.trim());

  if (!ink?.length) throw new Error(`No --et-color-primary-ink values in .et-color--${theme}`);

  return ink.join('\n');
};

const schemeInkThemesOf = (css) => [...css.matchAll(/\.et-color--([\w-]+)-on-light \{/g)].map((match) => match[1]);

const inkRule = (selectors, ink, depth) => {
  const pad = ' '.repeat(depth);

  return `${pad}${selectors.join(`,\n${pad}`)} {\n${ink.replace(/^/gm, `${pad}  `)}\n${pad}}`;
};

const withSchemeInk = (css) => {
  const themes = schemeInkThemesOf(css);
  const inkFor = (theme, scheme) => inkOf(css, scheme === 'light' ? `${theme}-on-light` : theme);
  const rootOf = (theme, root) => (theme === 'brand' ? [root] : []);
  const media = themes.map((theme) =>
    inkRule([...rootOf(theme, ':root'), `.et-color--${theme}`], inkFor(theme, 'light'), 4),
  );
  const forced = (scheme) =>
    themes.map((theme) =>
      inkRule(
        [...rootOf(theme, `:root.et-scheme--${scheme}`), `:where(:root.et-scheme--${scheme}) .et-color--${theme}`],
        inkFor(theme, scheme),
        2,
      ),
    );
  const onSurface = (scheme) =>
    themes.map((theme) =>
      inkRule(
        [`.et-surface--${scheme}.et-color--${theme}`, `.et-surface--${scheme} .et-color--${theme}`],
        inkFor(theme, scheme),
        2,
      ),
    );

  return `${css}
@layer base {
  @media (prefers-color-scheme: light) {
${media.join('\n\n')}
  }

${[...forced('light'), ...forced('dark'), ...onSurface('light'), ...onSurface('dark')].join('\n\n')}
}
`;
};

const surfaceBodyOf = (css, name) => {
  const body = css.match(new RegExp(`\\.et-surface--${name} \\{\\n([\\s\\S]*?)\\n\\s*\\}`))?.[1];

  if (!body) throw new Error(`No .et-surface--${name} block`);

  return body;
};

const withElevatedFill = (css) => {
  const light = surfaceBodyOf(css, 'light-elevated');
  const dark = surfaceBodyOf(css, 'dark-elevated');
  const fill = '[data-et-surface-fill]';

  return `${css}
@layer base {
  .et-surface--light${fill} {
${light}
  }

  .et-surface--dark${fill} {
${dark}
  }

  @media (prefers-color-scheme: light) {
    .et-surface--inherited${fill} {
${light}
    }
  }

  @media (prefers-color-scheme: dark) {
    .et-surface--inherited${fill} {
${dark}
    }
  }

  :root.et-scheme--light .et-surface--inherited${fill} {
${light}
  }

  :root.et-scheme--dark .et-surface--inherited${fill} {
${dark}
  }
}
`;
};

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
const source = `${header}\n${withElevatedFill(withSchemeInk(withShadowColor(withoutUtilityColors(themeCss({ surfaceThemes, colorThemes })))))}\n${BASE}`;
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
