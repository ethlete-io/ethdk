/**
 * The slice of YAML a generated OpenAPI document needs: block mappings, block sequences, and scalars
 * that are either plain or double-quoted. JSON is a subset of YAML, so this writes the same tree the
 * JSON export writes - it is a second spelling of one document, not a second document.
 */

const INDENT = '  ';

/** How deep the tree is written before a branch is given up on, so a cyclic body cannot spin forever. */
const MAX_DEPTH = 64;

/**
 * A scalar YAML would read back as this exact string: it starts with a letter, `_` or `$`, so nothing
 * numeric or date-shaped gets through, and it holds none of `:#,[]{}&*!|>'"%@\`` that starts a construct.
 */
const PLAIN = /^[A-Za-z_$][A-Za-z0-9_$ ./+-]*$/;

/** Words YAML 1.1 readers still take for booleans or null, whatever case they are written in. */
const RESERVED: ReadonlySet<string> = /* @__PURE__ */ new Set([
  'true',
  'false',
  'null',
  'yes',
  'no',
  'on',
  'off',
  'y',
  'n',
]);

const isPlainSafe = (value: string) => PLAIN.test(value) && !value.endsWith(' ') && !RESERVED.has(value.toLowerCase());

/**
 * Whether a multi-line string can be written as a `|-` block. A line starting with a space would need an
 * explicit indentation indicator, and a trailing newline or a `\r` would not survive the round trip, so
 * those fall back to one quoted line.
 */
const isBlockSafe = (value: string) =>
  value.includes('\n') &&
  !value.endsWith('\n') &&
  !/[\r\t]/.test(value) &&
  value.split('\n').every((line) => !line.startsWith(' ') && !line.endsWith(' '));

const blockScalar = (value: string, indent: string) =>
  `|-\n${value
    .split('\n')
    .map((line) => (line ? `${indent}${line}` : ''))
    .join('\n')}`;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/** A scalar, or `null` when the value is one of the containers {@link write} handles itself. */
const scalarOf = (value: unknown, indent: string): string | null => {
  if (value === null || value === undefined) return 'null';

  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number':
      // `JSON.stringify` writes a non-finite number as `null`; both exports agree on that rather than
      // one of them emitting YAML's `.nan`, which no JSON reader takes back.
      return Number.isFinite(value) ? String(value) : 'null';
    case 'string':
      if (isBlockSafe(value)) return blockScalar(value, indent);

      return isPlainSafe(value) ? value : JSON.stringify(value);
    default:
      break;
  }

  if (Array.isArray(value) || isPlainObject(value)) return null;

  return 'null';
};

const write = (value: unknown, depth: number): string => {
  const indent = INDENT.repeat(depth);
  const scalar = scalarOf(value, indent);

  if (scalar !== null) return scalar;

  if (depth >= MAX_DEPTH) return 'null';

  if (Array.isArray(value)) {
    if (!value.length) return '[]';

    return `\n${value
      .map((entry) => {
        const written = write(entry, depth + 1);

        // A container under a `-` continues on the dash line: the `- ` occupies the first two columns of
        // its child's own indentation, so the child's first line has to shed exactly that much.
        return `${indent}- ${written.startsWith('\n') ? written.slice(depth * 2 + INDENT.length + 1) : written}`;
      })
      .join('\n')}`;
  }

  const entries = Object.entries(value as Record<string, unknown>).filter(([, entry]) => entry !== undefined);

  if (!entries.length) return '{}';

  return `\n${entries
    .map(([key, entry]) => {
      const written = write(entry, depth + 1);
      // A block already leads with its own newline; only a scalar needs the space after the colon.
      const rendered = written.startsWith('\n') ? written : ` ${written}`;

      return `${indent}${isPlainSafe(key) ? key : JSON.stringify(key)}:${rendered}`;
    })
    .join('\n')}`;
};

/**
 * Writes a JSON-shaped tree as YAML. `undefined` members are dropped the way `JSON.stringify` drops
 * them; anything that is not a plain object, array or primitive is written as `null`.
 */
export const toQueryDevtoolsYaml = (value: unknown) => `${write(value, 0).replace(/^\n/, '')}\n`;
