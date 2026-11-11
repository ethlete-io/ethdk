export type JsonStyle = { printWidth: number; tabWidth: number; useTabs: boolean };

export const DEFAULT_JSON_STYLE: JsonStyle = { printWidth: 80, tabWidth: 2, useTabs: false };

type Line = { value: unknown; depth: number; head: string; tail: string };

const isScalar = (value: unknown) => value === null || typeof value !== 'object';

const lineOf = (style: JsonStyle, { value, depth, head, tail }: Line): string => {
  const indent = style.useTabs ? '\t'.repeat(depth) : ' '.repeat(depth * style.tabWidth);
  const child = (item: unknown, at: { head: string; last: boolean }) =>
    lineOf(style, { value: item, depth: depth + 1, head: at.head, tail: at.last ? '' : ',' });

  if (Array.isArray(value)) {
    if (value.length === 0) return `${indent}${head}[]${tail}`;

    const inline = `${indent}${head}[${value.map((item) => JSON.stringify(item)).join(', ')}]${tail}`;
    const width = inline.length + (style.useTabs ? depth * (style.tabWidth - 1) : 0);

    if (value.every(isScalar) && width <= style.printWidth) return inline;

    const items = value.map((item, index) => child(item, { head: '', last: index === value.length - 1 }));

    return [`${indent}${head}[`, ...items, `${indent}]${tail}`].join('\n');
  }

  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).filter(([, item]) => item !== undefined);

    if (entries.length === 0) return `${indent}${head}{}${tail}`;

    const lines = entries.map(([key, item], index) =>
      child(item, { head: `${JSON.stringify(key)}: `, last: index === entries.length - 1 }),
    );

    return [`${indent}${head}{`, ...lines, `${indent}}${tail}`].join('\n');
  }

  return `${indent}${head}${JSON.stringify(value)}${tail}`;
};

/**
 * `value` as JSON text in the form Prettier writes for a `.json` file in `style`: objects one key per line, a scalar
 * array on one line when the line fits. Formats without a Prettier process.
 */
export const prettierJsonOf = (value: unknown, style: JsonStyle = DEFAULT_JSON_STYLE) =>
  `${lineOf(style, { value, depth: 0, head: '', tail: '' })}\n`;
