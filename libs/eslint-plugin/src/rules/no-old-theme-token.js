// @ts-check
'use strict';

const fs = require('node:fs');
const path = require('node:path');

/**
 * Flags the theme tokens the theming revision retired: the `-rgb` / `-solid` surface triplets, the
 * `--et-theme-color-*` and `--et-color-primary*` tones, `rgb(var(--et-surface-…))` triplet reads and, for each
 * configured Tailwind prefix, the old dynamic-theme and surface utilities. Runs on CSS (through the
 * `ethlete/css` language), TypeScript and templates by reading the file text.
 *
 * Detectors mirror `RETIRED_TOKEN_FAMILY` and `SURFACE_TRIPLET_READ` in
 * `libs/core/generators/migrate-theme-token-names/token-names.ts`; this plugin cannot depend on core.
 */

const RETIRED_TOKEN_FAMILY =
  /--et-(?:surface-[a-z0-9-]+-(?:rgb|solid)(?![\w-])|theme-color-[\w$-]*|color-(?:primary|on-primary|secondary|on-secondary|tertiary|on-tertiary)(?![a-z0-9]))/g;

const SURFACE_TRIPLET_READ =
  /\brgba?\(\s*var\(\s*--et-surface-(?:background|border|interaction|on-interaction|interaction-ink)(?:-(?:hover|focus|active|disabled))?\s*[,)]/g;

const SURFACE_PROPERTY_UTILITIES =
  '--color|bg|text|border|fill|stroke|ring|outline|divide|from|via|to|shadow|decoration|accent|caret';

/** @param {string} value */
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** @param {readonly string[]} prefixes */
const tailwindDetector = (prefixes) => {
  if (!prefixes.length) return null;

  const prefix = `(?:${prefixes.map(escapeRegExp).join('|')})`;
  const state = '(?:-(?:hover|focus|active|disabled))?';

  return new RegExp(
    [
      `(?<![A-Za-z0-9_])${prefix}-(?:on-)?theme(?:-ink)?${state}(?![\\w-])`,
      `(?<![A-Za-z0-9_])${prefix}-surface(?:-(?!${NEW_SURFACE_WORDS}(?![a-z0-9]))[a-z0-9]+)?-(?:bg|muted|subtle)(?![\\w-])`,
      `(?<=(?:${SURFACE_PROPERTY_UTILITIES})-)${prefix}-surface(?![\\w-])`,
    ].join('|'),
    'g',
  );
};

const STATE_SUFFIX = '(?:-(?:hover|focus|active|disabled))?';
const NEW_SURFACE_WORDS = '(?:background|border|interaction|on-interaction|interaction-ink|text|type)';
const GENERATED_COLOR_MARKER = '@ethlete/core:tailwind-4-color-theme';
const GENERATED_SURFACE_MARKER = '@ethlete/core:tailwind-4-surface-theme';
const STATES = ['hover', 'focus', 'active', 'disabled'];

/**
 * Reads the Tailwind prefix and theme names from the files a theme generator wrote, the way the
 * `migrate-theme-token-names` generator in `@ethlete/core` does.
 *
 * @param {string} cwd
 * @param {readonly string[]} patterns
 */
const readThemeNames = (cwd, patterns) => {
  /** @type {Map<string, Set<string>>} */
  const colors = new Map();
  /** @type {Map<string, Set<string>>} */
  const surfaces = new Map();

  const files = new Set(patterns.flatMap((pattern) => fs.globSync(pattern, { cwd })));

  for (const file of files) {
    const content = fs.readFileSync(path.resolve(cwd, file), 'utf8');
    const isColor = content.includes(GENERATED_COLOR_MARKER);
    const isSurface = content.includes(GENERATED_SURFACE_MARKER);

    if (!isColor && !isSurface) continue;

    const prefix = /--prefix=([\w-]+)/.exec(content)?.[1] ?? 'et';
    const target = isColor ? colors : surfaces;
    const names = target.get(prefix) ?? new Set();

    for (const match of content.matchAll(new RegExp(`/\\* ([\\w-]+) ${isColor ? 'theme' : 'surface'} \\*/`, 'g'))) {
      names.add(/** @type {string} */ (match[1]));
    }

    target.set(prefix, names);
  }

  return { colors, surfaces };
};

/** @type {Map<string, ReturnType<typeof readThemeNames>>} */
const themeNameCache = new Map();

/** @param {ReturnType<typeof readThemeNames>} names */
const themeNameDetector = ({ colors, surfaces }) => {
  /** @type {string[]} */
  const old = [];
  const withStates = (/** @type {string} */ name) => [name, ...STATES.map((state) => `${name}-${state}`)];

  for (const [prefix, themes] of colors) {
    for (const theme of ['theme', ...themes]) {
      old.push(...withStates(`${prefix}-${theme}`), ...withStates(`${prefix}-on-${theme}`));
      old.push(...withStates(`${prefix}-${theme}-ink`));
    }
  }

  for (const [prefix, names] of surfaces) {
    for (const name of ['', ...[...names].map((n) => `-${n}`)]) {
      old.push(`${prefix}-surface${name}`, `${prefix}-surface${name}-bg`);
      old.push(`${prefix}-surface${name}-muted`, `${prefix}-surface${name}-subtle`);
    }
  }

  if (!old.length) return null;

  const alternatives = [...new Set(old)].sort((a, b) => b.length - a.length).map(escapeRegExp);

  return new RegExp(`(?<=[a-z0-9]-)(?<!\\bdata-)(?:${alternatives.join('|')})(?![\\w-])`, 'g');
};

/** @param {readonly string[]} prefixes */
const unknownNameCandidate = (prefixes) => {
  if (!prefixes.length) return null;

  const prefix = `(?:${prefixes.map(escapeRegExp).join('|')})`;

  return new RegExp(
    `(?<=(?:${SURFACE_PROPERTY_UTILITIES})-)${prefix}-(?!tone-|surface-(?:[a-z0-9]+-)*?${NEW_SURFACE_WORDS}(?:-(?:muted|subtle))?${STATE_SUFFIX}(?![\\w-]))[a-z][a-z0-9-]*`,
    'g',
  );
};

/** @type {import('eslint').Rule.RuleModule} */
const noOldTheme = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow the retired theme tokens (surface -rgb/-solid triplets, --et-theme-color-*, --et-color-primary*) and the old Tailwind theme utilities.',
      recommended: false,
    },
    messages: {
      retiredToken: "'{{name}}' is a retired theme token. See the name table in the theming guide for its replacement.",
      tripletRead:
        "'{{name}}' reads a surface token as an RGB triplet. The token is a color now: use it directly or in color-mix().",
      unknownThemeNames:
        "'{{name}}' could be an old tone or surface class, but the theme names are unknown. Set the 'themeFiles' option to the generated theme CSS files.",
      tailwindName: "'{{name}}' is an old Tailwind theme name. Use the tone/surface names from the theming guide.",
    },
    schema: [
      {
        type: 'object',
        properties: {
          prefixes: { type: 'array', items: { type: 'string' }, uniqueItems: true },
          themeFiles: { type: 'array', items: { type: 'string' }, uniqueItems: true },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const options = /** @type {{ prefixes?: string[]; themeFiles?: string[] } | undefined} */ (context.options[0]);
    const prefixes = options?.prefixes ?? ['et'];
    const tailwind = tailwindDetector(prefixes);
    const cacheKey = `${context.cwd}\0${JSON.stringify(options?.themeFiles ?? [])}`;
    let names = themeNameCache.get(cacheKey);

    if (!names) {
      names = readThemeNames(context.cwd, options?.themeFiles ?? []);
      themeNameCache.set(cacheKey, names);
    }

    const named = themeNameDetector(names);
    const unknownCandidate = named ? null : unknownNameCandidate(prefixes);
    const sourceCode = context.sourceCode;

    const detectors = [
      { regex: RETIRED_TOKEN_FAMILY, messageId: 'retiredToken' },
      { regex: SURFACE_TRIPLET_READ, messageId: 'tripletRead' },
      ...(tailwind ? [{ regex: tailwind, messageId: 'tailwindName' }] : []),
      ...(named ? [{ regex: named, messageId: 'tailwindName' }] : []),
    ];

    const check = () => {
      const text = sourceCode.text;
      const reported = new Set();

      for (const { regex, messageId } of detectors) {
        regex.lastIndex = 0;

        for (const match of text.matchAll(regex)) {
          const start = match.index ?? 0;

          if (reported.has(start)) continue;
          reported.add(start);

          const end = start + match[0].length;
          const startLoc = sourceCode.getLocFromIndex(start);
          const endLoc = sourceCode.getLocFromIndex(end);

          context.report({
            messageId,
            data: { name: match[0] },
            loc: { start: startLoc, end: endLoc },
          });
        }
      }

      if (unknownCandidate) {
        const match = [...text.matchAll(unknownCandidate)].find((m) => !reported.has(m.index));

        if (match) {
          const start = match.index ?? 0;
          context.report({
            messageId: 'unknownThemeNames',
            data: { name: match[0] },
            loc: {
              start: sourceCode.getLocFromIndex(start),
              end: sourceCode.getLocFromIndex(start + match[0].length),
            },
          });
        }
      }
    };

    return { Program: check, Root: check };
  },
};

module.exports = noOldTheme;
