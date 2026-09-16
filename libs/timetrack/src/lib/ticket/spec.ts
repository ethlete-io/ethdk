/** The longest intent that may leave the machine. The tracks measured so far run 252 to 707 characters. */
const MAX_INTENT_LENGTH = 1200;

/** The files a directory must hold to be read as a spec. */
export const SPEC_METADATA_FILE = 'metadata.json';
export const SPEC_INDEX_FILE = 'index.md';

/**
 * The slice of a spec document that may leave this machine: what the work is called, what kind of work
 * it is, and the paragraph the spec opens with. The body of a spec never goes — see ADR 0013.
 */
export type SpecHeader = {
  title: string;
  /** What kind of work the spec describes, such as `feature`. */
  type?: string;
  tags?: string[];
  /** The first section of the index, which is where a spec states what it is for. */
  intent?: string;
  /** The parent issue the spec already names, so nothing has to be written for it. */
  epicKey?: string;
};

const asString = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);

const asTags = (value: unknown) =>
  Array.isArray(value) ? value.map(asString).filter((tag): tag is string => !!tag) : undefined;

/**
 * Reads the first `##` section of a spec index.
 *
 * The heading is never matched by name: the tracks measured call it `Kurzfassung`, one calls it
 * `Kurzbeschreibung`, and an English repository would call it something else again. Position is the
 * only thing every layout agrees on.
 */
const intentOf = (index: string) => {
  const lines = index.split('\n');
  const start = lines.findIndex((line) => line.startsWith('## '));

  if (start < 0) return undefined;

  const after = lines.slice(start + 1);
  const end = after.findIndex((line) => line.startsWith('## '));
  const body = (end < 0 ? after : after.slice(0, end)).join('\n').trim();

  return body ? body.slice(0, MAX_INTENT_LENGTH) : undefined;
};

/**
 * Builds the sendable slice from the two files a spec directory holds. Answers null where the metadata
 * names no title, because a spec that cannot say what it is called says nothing a ticket can use.
 *
 * `assignee` is in the metadata and is deliberately not read: a colleague's name has no place in a
 * payload that leaves the machine, and leaving it unread is stronger than masking it.
 */
export const readSpecHeader = (options: { metadata: string; index?: string }): SpecHeader | null => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(options.metadata);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object') return null;

  const record = parsed as Record<string, unknown>;
  const title = asString(record['title']);

  if (!title) return null;

  return {
    title,
    type: asString(record['type']),
    tags: asTags(record['tags']),
    intent: options.index ? intentOf(options.index) : undefined,
    epicKey: asString(record['jira_epic']),
  };
};

/**
 * Ranks the directories a set of commits touched: the deepest first, and among equals the most
 * touched. The directory that holds a spec is somewhere in this list; which one actually holds the two
 * files is a question only the file system answers, so the caller walks the list in order and stops at
 * the first that does.
 *
 * A path that leaves the checkout is dropped rather than climbed past.
 */
export const touchedDirectories = (paths: readonly string[]): string[] => {
  const touches = new Map<string, { depth: number; count: number }>();

  for (const path of paths) {
    const segments = path.split('/').filter((segment) => segment && segment !== '.');

    if (segments.includes('..')) continue;

    for (let depth = segments.length - 1; depth > 0; depth--) {
      const directory = segments.slice(0, depth).join('/');
      const seen = touches.get(directory);

      touches.set(directory, { depth, count: (seen?.count ?? 0) + 1 });
    }
  }

  return [...touches.entries()]
    .sort(([aName, a], [bName, b]) => b.depth - a.depth || b.count - a.count || aName.localeCompare(bName))
    .map(([directory]) => directory);
};
