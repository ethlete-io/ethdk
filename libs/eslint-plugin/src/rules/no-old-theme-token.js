// @ts-check
'use strict';

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
      `(?<![A-Za-z0-9_])${prefix}-surface(?:-[a-z0-9]+)?-(?:bg|muted|subtle)(?![\\w-])`,
      `(?<=(?:${SURFACE_PROPERTY_UTILITIES})-)${prefix}-surface(?![\\w-])`,
    ].join('|'),
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
      tailwindName: "'{{name}}' is an old Tailwind theme name. Use the tone/surface names from the theming guide.",
    },
    schema: [
      {
        type: 'object',
        properties: {
          prefixes: { type: 'array', items: { type: 'string' }, uniqueItems: true },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const options = /** @type {{ prefixes?: string[] } | undefined} */ (context.options[0]);
    const tailwind = tailwindDetector(options?.prefixes ?? ['et']);
    const sourceCode = context.sourceCode;

    const detectors = [
      { regex: RETIRED_TOKEN_FAMILY, messageId: 'retiredToken' },
      { regex: SURFACE_TRIPLET_READ, messageId: 'tripletRead' },
      ...(tailwind ? [{ regex: tailwind, messageId: 'tailwindName' }] : []),
    ];

    const check = () => {
      const text = sourceCode.text;

      for (const { regex, messageId } of detectors) {
        regex.lastIndex = 0;

        for (const match of text.matchAll(regex)) {
          const start = match.index ?? 0;
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
    };

    return { Program: check, Root: check };
  },
};

module.exports = noOldTheme;
