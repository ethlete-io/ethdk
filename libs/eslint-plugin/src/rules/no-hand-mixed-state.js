// @ts-check
'use strict';

const STATE_SELECTOR =
  /:(?:hover|active|focus|focus-visible|focus-within|checked)\b|\[(?:aria-(?:pressed|selected|checked|current|expanded)|data-(?:active|selected|pressed|highlighted|checked))\b/;

const STATE_CUSTOM_PROPERTY = /^--[\w-]*(?:hover|pressed|active|selected|checked|highlight)/;

const STATE_BACKGROUND_PROPERTY = /^(?:background|background-color)$/;

const SURFACE_TINT_READ = /var\(\s*--et-surface-tint\s*(?=[,)])/g;

const COLOR_FUNCTION = /^(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i;

const NAMED_COLORS = new Set([
  'currentcolor',
  'black',
  'white',
  'gray',
  'grey',
  'silver',
  'red',
  'green',
  'blue',
  'yellow',
  'orange',
  'purple',
  'canvas',
  'canvastext',
  'buttonface',
  'buttontext',
  'highlight',
  'highlighttext',
]);

/** @param {string} text */
const blankComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '));

/**
 * @param {string} text
 * @param {number} open index of the `(`
 */
const closingParen = (text, open) => {
  let depth = 0;

  for (let i = open; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')' && --depth === 0) return i;
  }

  return text.length;
};

/**
 * Splits the arguments of the function whose `(` is at `open` at top-level commas.
 *
 * @param {string} text
 * @param {number} open
 */
const functionArgs = (text, open) => {
  const end = closingParen(text, open);
  /** @type {{ text: string; start: number }[]} */
  const args = [];
  let depth = 0;
  let start = open + 1;

  for (let i = open + 1; i < end; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')') depth--;
    else if (text[i] === ',' && depth === 0) {
      args.push({ text: text.slice(start, i), start });
      start = i + 1;
    }
  }

  args.push({ text: text.slice(start, end), start });

  return args.map((arg) => {
    const lead = arg.text.length - arg.text.trimStart().length;
    return { text: arg.text.trim(), start: arg.start + lead };
  });
};

/** @param {string} operand */
const colorOf = (operand) => operand.replace(/\s+\d+(?:\.\d+)?%$/, '').trim();

/** @param {string} color */
const isStaticColor = (color) =>
  color.startsWith('#') || COLOR_FUNCTION.test(color) || NAMED_COLORS.has(color.toLowerCase());

/**
 * Yields every declaration with the selectors that enclose it.
 *
 * @param {string} text
 */
function* declarations(text) {
  /** @type {string[]} */
  const preludes = [];
  let segmentStart = 0;
  let parenDepth = 0;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === '"' || char === "'") {
      const close = text.indexOf(char, i + 1);
      i = close === -1 ? text.length : close;
      continue;
    }

    if (char === '(') parenDepth++;
    else if (char === ')') parenDepth = Math.max(0, parenDepth - 1);

    if (parenDepth > 0) continue;

    if (char === '{') {
      preludes.push(text.slice(segmentStart, i).trim());
      segmentStart = i + 1;
    } else if (char === ';' || char === '}') {
      const segment = text.slice(segmentStart, i);
      const colon = segment.indexOf(':');

      if (colon !== -1 && !segment.trimStart().startsWith('@')) {
        const property = segment.slice(0, colon).trim();
        const rawValue = segment.slice(colon + 1);
        const lead = rawValue.length - rawValue.trimStart().length;

        yield {
          property,
          value: rawValue.trim(),
          valueStart: segmentStart + colon + 1 + lead,
          preludes: [...preludes],
        };
      }

      if (char === '}') preludes.pop();
      segmentStart = i + 1;
    }
  }
}

/** @type {import('eslint').Rule.RuleModule} */
const noHandMixedState = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require interaction states to mix the surface tint with the surface text fallback instead of a hand-picked colour.',
      recommended: false,
    },
    messages: {
      tintWithoutText:
        "'{{text}}' reads the surface tint without the surface text fallback. A state mixes 'color-mix(in srgb, var(--et-surface-tint, var(--et-surface-text, <fallback>)) N%, transparent)', so it stays visible when a theme sets no tint.",
      controlTextMix:
        "'{{text}}' mixes the control text colour into a state. Mix 'var(--et-surface-tint, var(--et-surface-text, <fallback>))' instead.",
      staticState:
        "'{{text}}' is a hand-picked state colour. Mix 'var(--et-surface-tint, var(--et-surface-text, <fallback>))' or read a tone token instead.",
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode;

    /**
     * @param {'tintWithoutText' | 'controlTextMix' | 'staticState'} messageId
     * @param {number} start
     * @param {string} text
     */
    const report = (messageId, start, text) =>
      context.report({
        messageId,
        data: { text },
        loc: { start: sourceCode.getLocFromIndex(start), end: sourceCode.getLocFromIndex(start + text.length) },
      });

    const check = () => {
      const text = blankComments(sourceCode.text);

      for (const declaration of declarations(text)) {
        const { property, value, valueStart, preludes } = declaration;

        for (const match of value.matchAll(SURFACE_TINT_READ)) {
          const open = valueStart + (match.index ?? 0) + 3;
          const [, fallback] = functionArgs(text, open);

          if (fallback?.text.startsWith('var(--et-surface-text')) continue;

          report(
            'tintWithoutText',
            valueStart + (match.index ?? 0),
            text.slice(valueStart + (match.index ?? 0), closingParen(text, open) + 1),
          );
        }

        const inState =
          preludes.some((prelude) => STATE_SELECTOR.test(prelude)) ||
          (property.startsWith('--') && STATE_CUSTOM_PROPERTY.test(property));
        const statePaint = inState && (STATE_BACKGROUND_PROPERTY.test(property) || property.startsWith('--'));

        for (const match of value.matchAll(/(?<![\w-])color-mix\(/g)) {
          const open = valueStart + (match.index ?? 0) + 'color-mix'.length;
          const [, first] = functionArgs(text, open);

          if (!first) continue;

          const color = colorOf(first.text);

          if (/^var\(\s*--et-surface-control-text\b/.test(color)) {
            report('controlTextMix', first.start, color);
          } else if (statePaint && (isStaticColor(color) || /^var\(\s*--et-surface-text\b/.test(color))) {
            report('staticState', first.start, color);
          }
        }

        if (statePaint && !value.includes('(') && isStaticColor(value)) {
          report('staticState', valueStart, value);
        } else if (statePaint && COLOR_FUNCTION.test(value) && !/^color\(/i.test(value)) {
          report('staticState', valueStart, value.slice(0, closingParen(value, value.indexOf('(')) + 1));
        }
      }
    };

    return { Root: check, Program: check };
  },
};

module.exports = noHandMixedState;
