export const CONTENT_KINDS = ['rule', 'skill'] as const;
export const CONTENT_SCOPES = ['consumer', 'sdk', 'both'] as const;

export type ContentKind = (typeof CONTENT_KINDS)[number];
export type ContentScope = (typeof CONTENT_SCOPES)[number];

export type Frontmatter = {
  name: string;
  description: string;
  kind: ContentKind;
  scope: ContentScope;
  requires: string[];
  paths: string[];
  vars: string[];
};

export type ParsedDocument = {
  frontmatter: Frontmatter;
  body: string;
};

const FENCE = '---';
const KNOWN_KEYS = ['name', 'description', 'kind', 'scope', 'requires', 'paths', 'vars'];
const LIST_KEYS = ['requires', 'paths', 'vars'];

const unquote = (value: string) => {
  const trimmed = value.trim();
  const quoted =
    trimmed.length >= 2 &&
    ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"')));

  return quoted ? trimmed.slice(1, -1) : trimmed;
};

const parseInlineList = (value: string) => {
  const inner = value.trim().slice(1, -1).trim();

  if (!inner) return [];

  return inner
    .split(',')
    .map(unquote)
    .filter((entry) => entry.length > 0);
};

const splitBlock = (source: string, origin: string) => {
  const normalized = source.replace(/\r\n/g, '\n');
  const padded = normalized.endsWith('\n') ? normalized : `${normalized}\n`;

  if (!padded.startsWith(`${FENCE}\n`)) {
    throw new Error(`${origin}: missing the opening '---' frontmatter fence.`);
  }

  const end = padded.indexOf(`\n${FENCE}\n`, FENCE.length);

  if (end === -1) {
    throw new Error(`${origin}: the frontmatter block is never closed with '---'.`);
  }

  return {
    head: padded.slice(FENCE.length + 1, end).split('\n'),
    body: padded.slice(end + FENCE.length + 2).replace(/^\n+/, ''),
  };
};

/**
 * Reads the tiny subset of YAML the content files are allowed to use: single-line
 * `key: value` pairs, inline `key: [a, b]` lists, and `- item` block lists. Anything
 * else throws — silently mis-parsing an agent instruction is worse than failing the build.
 */
export const parseFrontmatter = (source: string, origin: string): ParsedDocument => {
  const { head, body } = splitBlock(source, origin);
  const raw: Record<string, string | string[]> = {};

  let listKey: string | null = null;

  for (const line of head) {
    if (!line.trim() || line.trim().startsWith('#')) continue;

    const item = /^\s*-\s+(.*)$/.exec(line);

    if (item?.[1] !== undefined) {
      if (!listKey) {
        throw new Error(`${origin}: list item "${line.trim()}" does not belong to a key.`);
      }

      (raw[listKey] as string[]).push(unquote(item[1]));
      continue;
    }

    const separator = line.indexOf(':');

    if (separator === -1) {
      throw new Error(`${origin}: cannot parse frontmatter line "${line}".`);
    }

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();

    if (!KNOWN_KEYS.includes(key)) {
      throw new Error(`${origin}: unknown frontmatter key "${key}". Known keys: ${KNOWN_KEYS.join(', ')}.`);
    }

    if (LIST_KEYS.includes(key) && !value) {
      raw[key] = [];
      listKey = key;
      continue;
    }

    listKey = null;
    raw[key] = value.startsWith('[') ? parseInlineList(value) : unquote(value);
  }

  const readText = (key: string) => {
    const value = raw[key];

    return typeof value === 'string' ? value : undefined;
  };

  const readList = (key: string) => {
    const value = raw[key];

    if (value === undefined) return [];

    return Array.isArray(value) ? value : [value];
  };

  const name = readText('name');
  const description = readText('description');
  const kind = readText('kind');
  const scope = readText('scope') ?? 'consumer';

  if (!name) throw new Error(`${origin}: frontmatter is missing "name".`);
  if (!description) throw new Error(`${origin}: frontmatter is missing "description".`);
  if (!kind) throw new Error(`${origin}: frontmatter is missing "kind".`);

  if (!CONTENT_KINDS.includes(kind as ContentKind)) {
    throw new Error(`${origin}: kind "${kind}" must be one of ${CONTENT_KINDS.join(', ')}.`);
  }

  if (!CONTENT_SCOPES.includes(scope as ContentScope)) {
    throw new Error(`${origin}: scope "${scope}" must be one of ${CONTENT_SCOPES.join(', ')}.`);
  }

  return {
    frontmatter: {
      name,
      description,
      kind: kind as ContentKind,
      scope: scope as ContentScope,
      requires: readList('requires'),
      paths: readList('paths'),
      vars: readList('vars'),
    },
    body: body.trimEnd(),
  };
};
