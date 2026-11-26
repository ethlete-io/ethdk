const WIDTH = 120;
const INDENT = '  ';

const entriesOf = (value: object): [string, unknown][] =>
  Object.entries(value).filter(([, item]) => item !== undefined);

const breaksArray = (items: unknown[]) =>
  items.length > 1 && items.every((item) => Array.isArray(item) && item.length > 1);

const flatOf = (value: unknown): string | null => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (!Array.isArray(value)) return entriesOf(value).length === 0 ? '{}' : null;
  if (breaksArray(value)) return null;

  const items = value.map(flatOf);

  return items.every((item) => item !== null) ? `[${items.join(', ')}]` : null;
};

const print = (value: unknown, line: { indent: string; column: number; tail: number }): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);

  const flat = Array.isArray(value) || entriesOf(value).length === 0 ? flatOf(value) : null;

  if (flat !== null && line.column + flat.length + line.tail <= WIDTH) return flat;

  const indent = `${line.indent}${INDENT}`;
  const entries: [string, unknown][] = Array.isArray(value)
    ? value.map((item) => ['', item])
    : entriesOf(value).map(([key, item]) => [`${JSON.stringify(key)}: `, item]);
  const lines = entries.map(([prefix, item], index) => {
    const tail = index < entries.length - 1 ? 1 : 0;

    return `${indent}${prefix}${print(item, { indent, column: indent.length + prefix.length, tail })}${tail ? ',' : ''}`;
  });
  const [open, close] = Array.isArray(value) ? ['[', ']'] : ['{', '}'];

  return `${open}\n${lines.join('\n')}\n${line.indent}${close}`;
};

/**
 * Serializes JSON data the way Prettier lays out a `.json` file at a print width of 120: objects stay
 * expanded, an array stays on one line when it fits. Ends with a newline.
 */
export const jsonLayoutOf = (value: unknown) => `${print(value, { indent: '', column: 0, tail: 0 })}\n`;
