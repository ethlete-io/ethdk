import { Signal, signal } from '@angular/core';

/**
 * A JSON-pointer-style path into a response body: object keys and array indices, root first. Captured
 * by the devtools panel from wherever the user opened the overrides menu in the value explorer.
 */
export type JsonPath = (string | number)[];

/**
 * One path-addressed edit an override registry replays against the live response on every fetch. Unlike
 * the panel's raw-JSON JIT editor, an op describes *how* to change a value rather than freezing the
 * whole body, which is what lets it survive a refetch that returns a differently-valued but same-shaped
 * response.
 *
 * `reset` is never stored or replayed - arming one clears the other ops already armed at its path or
 * anywhere below it instead, so the panel's "reset this value" action and its "arm an edit" actions
 * share one entry point. Resetting a container therefore undoes a "fill recursively" run, whose ops
 * sit on the leaves rather than on the container itself.
 *
 * `pasteArrayItem` splices rather than writing at an index, and treats an absent `index` as "at the
 * end": a refetch that returns a shorter array would leave an index-addressed write sitting past the
 * end, turning the gap into `null`s.
 *
 * `deleteAt` removes whatever sits at `path` from its parent - a key from an object, or an element from
 * an array by splicing it out, so the ones after it shift down rather than leaving a hole. It is the only
 * op that can make a field *absent* rather than empty, which is a different thing to the code reading it.
 *
 * On the preset ops, `custom` - when present - is the exact value replayed, and `preset` is only the
 * label it was generated under. Values are generated once at arm time and stored, never re-rolled
 * inside apply, so a refetch replays the same response instead of reshuffling it.
 */
export type OverrideOp =
  | { type: 'set'; path: JsonPath; value: unknown }
  | {
      type: 'stringPreset';
      path: JsonPath;
      preset: 'short' | 'long' | 'longWord' | 'unicode' | 'custom';
      custom?: string;
    }
  | { type: 'numberPreset'; path: JsonPath; preset: 'zero' | 'negative' | 'huge' | 'custom'; custom?: number }
  | { type: 'booleanFlip'; path: JsonPath }
  | {
      type: 'datePreset';
      path: JsonPath;
      preset: 'now' | 'plusDay' | 'minusDay' | 'farFuture' | 'farPast' | 'invalid';
    }
  | { type: 'duplicateArrayItem'; path: JsonPath; index: number }
  | { type: 'pasteArrayItem'; path: JsonPath; value: unknown; index?: number }
  | { type: 'deleteAt'; path: JsonPath }
  | { type: 'duplicateArray'; path: JsonPath }
  | { type: 'paginationResize'; path: JsonPath; mode: 'shrink' | 'extend'; amount: number }
  | { type: 'reset'; path: JsonPath };

/** One op armed on a query, with the id its owning {@link QueryDevtoolsOverridesHandle} lists it under. */
export type QueryDevtoolsOverrideEntry = { id: string; op: OverrideOp };

/** The read side of an overrides recorder, as a {@link QueryDevtoolsEntry} exposes it to the panel. */
export type QueryDevtoolsOverridesHandle = {
  /** Every op currently armed on this query, oldest first - the order {@link applyQueryDevtoolsOverrides} replays them in. */
  list: Signal<readonly QueryDevtoolsOverrideEntry[]>;

  /** Disarms one op by id. */
  clear: (id: string) => void;

  /** Disarms every op on this query. */
  clearAll: () => void;
};

/** The write side, used by the instrumentation inside the query itself. */
export type QueryDevtoolsOverridesRecorder = QueryDevtoolsOverridesHandle & {
  /**
   * Arms a new op, or - for `{ type: 'reset' }` - disarms whatever op(s) already sit at that path or
   * below it instead of adding one.
   */
  arm: (op: OverrideOp) => void;

  /**
   * Replays every armed op against `raw`, in arming order, and returns the result. An op whose path no
   * longer resolves against `raw` is skipped rather than thrown - see {@link applyQueryDevtoolsOverrides}.
   * @internal
   */
  apply: (raw: unknown) => unknown;
};

const isPathAtOrBelow = (path: JsonPath, root: JsonPath) =>
  path.length >= root.length && root.every((step, index) => step === path[index]);

/**
 * Whether any of `entries` is armed at `path` or anywhere below it - what the panel's menu asks before
 * offering "Reset", so the destructive action is hidden where it would be a silent no-op.
 */
export const hasQueryDevtoolsOverridesAtPath = (entries: readonly QueryDevtoolsOverrideEntry[], path: JsonPath) =>
  entries.some((entry) => isPathAtOrBelow(entry.op.path, path));

type PathResolution =
  | { ok: true; exists: boolean; value: unknown }
  | {
      ok: false;
    };

/**
 * Walks `path` into `root`, stopping as soon as a step's container doesn't exist. An empty path
 * resolves to `root` itself, which is how an op targets the response's top-level value.
 */
const resolvePath = (root: unknown, path: JsonPath): PathResolution => {
  if (path.length === 0) return { ok: true, exists: true, value: root };

  let current = root;

  for (let index = 0; index < path.length - 1; index++) {
    if (current === null || typeof current !== 'object') return { ok: false };

    const step = path[index] as string | number;
    const container = current as Record<string | number, unknown>;

    if (!(step in container)) return { ok: false };

    current = container[step];
  }

  if (current === null || typeof current !== 'object') return { ok: false };

  const key = path[path.length - 1] as string | number;
  const container = current as Record<string | number, unknown>;
  const exists = key in container;

  return { ok: true, exists, value: exists ? container[key] : undefined };
};

/**
 * Returns a copy of `root` with `value` written at `path`, cloning only the containers along the way -
 * every sibling branch keeps its original reference. The final path segment does not need to already
 * exist (a `set` can add a new key); every segment before it does.
 */
const withValueAtPath = (root: unknown, path: JsonPath, value: unknown): unknown => {
  if (path.length === 0) return value;

  const [head, ...rest] = path as [string | number, ...JsonPath];

  if (Array.isArray(root)) {
    const next = [...root];
    next[head as number] = withValueAtPath(root[head as number], rest, value);

    return next;
  }

  const container = root && typeof root === 'object' ? (root as Record<string, unknown>) : {};
  return { ...container, [head]: withValueAtPath(container[head], rest, value) };
};

/**
 * Returns a copy of `root` with the value at `path` removed from its parent, cloning only the containers
 * along the way. An array parent splices, so the elements after it shift down instead of the slot
 * becoming a hole that serializes back as `null`.
 */
const withoutValueAtPath = (root: unknown, path: JsonPath): unknown => {
  const [head, ...rest] = path as [string | number, ...JsonPath];

  if (rest.length === 0) {
    if (Array.isArray(root)) {
      const next = [...root];
      next.splice(head as number, 1);

      return next;
    }

    const { [head as string]: _dropped, ...remaining } = root as Record<string, unknown>;

    return remaining;
  }

  if (Array.isArray(root)) {
    const next = [...root];
    next[head as number] = withoutValueAtPath(root[head as number], rest);

    return next;
  }

  const container = root as Record<string, unknown>;

  return { ...container, [head]: withoutValueAtPath(container[head], rest) };
};

const IDENTITY_KEY_PATTERNS = [/^id$/i, /(^|[a-z])Id$/, /^uuid$/i, /^key$/i];

const isIdentityKey = (key: string) => IDENTITY_KEY_PATTERNS.some((pattern) => pattern.test(key));

/** Whether every sibling in `array` that has `key` holds a distinct string/number value for it. */
const isSiblingUniqueKey = (array: readonly unknown[], key: string) => {
  const seen = new Set<unknown>();

  for (const item of array) {
    const value = (item as Record<string, unknown> | null)?.[key];
    if (value === undefined) continue;
    if (typeof value !== 'string' && typeof value !== 'number') return false;
    if (seen.has(value)) return false;
    seen.add(value);
  }

  return seen.size > 0;
};

const nextNumericId = (array: readonly unknown[], key: string) => {
  let max = -Infinity;

  for (const item of array) {
    const value = (item as Record<string, unknown> | null)?.[key];
    if (typeof value === 'number' && value > max) max = value;
  }

  return Number.isFinite(max) ? max + 1 : 1;
};

const nextStringId = (array: readonly unknown[], key: string, base: string) => {
  const existing = new Set(array.map((item) => (item as Record<string, unknown> | null)?.[key]));

  let suffix = 1;
  while (existing.has(`${base}-copy-${suffix}`)) suffix++;

  return `${base}-copy-${suffix}`;
};

/**
 * Clones `item` (a plain object array element) with every identity-shaped field replaced by a fresh
 * value, so a duplicated row never collides with the one it was copied from. A field counts as identity
 * when its key looks like one (`id`, `fooId`, `uuid`, `key`) or every sibling in `siblings` holds a
 * distinct value for it - without this, `track` bindings and detail-by-id lookups can't tell the copy
 * from the original.
 */
export const smartDuplicateArrayItem = (item: unknown, siblings: readonly unknown[]): unknown => {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return item;

  const source = item as Record<string, unknown>;
  const result: Record<string, unknown> = { ...source };

  for (const key of Object.keys(source)) {
    const value = source[key];

    if (!isIdentityKey(key) && !isSiblingUniqueKey(siblings, key)) continue;

    if (typeof value === 'number') result[key] = nextNumericId(siblings, key);
    else if (typeof value === 'string') result[key] = nextStringId(siblings, key, value);
  }

  return result;
};

const duplicateOneArrayItem = (array: readonly unknown[], index: number): unknown[] => {
  const copy = smartDuplicateArrayItem(array[index], array);
  const next = [...array];
  next.splice(index + 1, 0, copy);
  return next;
};

const duplicateWholeArray = (array: readonly unknown[]): unknown[] => {
  let result = [...array];

  for (const item of array) result = [...result, smartDuplicateArrayItem(item, result)];

  return result;
};

/**
 * The shape of a paginated response this module knows how to resize, matching the variants declared in
 * `@ethlete/types`' pagination types.
 */
type PaginationShape = 'gg-like' | 'dyn-like' | 'normalized' | 'contentful-gql-like';

/**
 * Whether `value` structurally matches one of the pagination shapes shrink/extend know how to resize -
 * an `items` array plus a recognized combination of total/page/limit counters. Exported so the panel's
 * menu can offer shrink/extend only where it would actually apply.
 */
export const detectPaginationShape = (value: unknown): PaginationShape | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const obj = value as Record<string, unknown>;
  if (!Array.isArray(obj['items'])) return null;

  const hasNumbers = (...keys: string[]) => keys.every((key) => typeof obj[key] === 'number');

  if (hasNumbers('totalHits', 'currentPage', 'totalPageCount', 'itemsPerPage')) return 'gg-like';
  if (hasNumbers('totalHits', 'currentPage', 'totalPages', 'limit')) return 'dyn-like';
  if (hasNumbers('totalPages', 'totalHits', 'currentPage', 'itemsPerPage')) return 'normalized';
  if (hasNumbers('limit', 'skip', 'total')) return 'contentful-gql-like';

  return null;
};

const DATE_KEY_PATTERN = /date|At$|Timestamp/i;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

/**
 * Whether a leaf is offered date presets instead of string presets: its key looks date-shaped
 * (`date`, `fooAt`, `fooTimestamp`) and its value round-trips through `Date.parse`, or the value
 * itself matches an ISO-8601 date/datetime pattern regardless of what its key is called. Exported so
 * the panel's menu can decide which preset list to show without duplicating the check.
 */
export const isDateShapedLeaf = (key: string | number | null, value: unknown) => {
  if (typeof value !== 'string') return false;
  if (typeof key === 'string' && DATE_KEY_PATTERN.test(key) && !Number.isNaN(Date.parse(value))) return true;

  return ISO_DATE_PATTERN.test(value);
};

/**
 * Every path under `value` (relative to it, not absolute) whose leaf is of `kind` - the paths a "fill
 * recursively" menu action turns into one `set`-family op each. Exported so the panel's menu builds the
 * op list with the exact same walk the docs describe, rather than a second, possibly-drifted one.
 */
export const collectLeafPaths = (value: unknown, kind: 'string' | 'number' | 'boolean'): JsonPath[] => {
  const paths: JsonPath[] = [];

  const walk = (node: unknown, path: JsonPath) => {
    if (Array.isArray(node)) {
      node.forEach((item, index) => walk(item, [...path, index]));

      return;
    }

    if (node && typeof node === 'object') {
      for (const [key, child] of Object.entries(node)) walk(child, [...path, key]);

      return;
    }

    if (typeof node === kind) paths.push(path);
  };

  walk(value, []);

  return paths;
};

const resizePagination = (
  value: Record<string, unknown>,
  shape: PaginationShape,
  mode: 'shrink' | 'extend',
  amount: number,
): Record<string, unknown> => {
  const items = value['items'] as unknown[];

  let nextItems: unknown[];

  if (mode === 'shrink') {
    nextItems = items.slice(0, Math.max(0, items.length - amount));
  } else if (items.length === 0) {
    // Nothing to clone a new item from - degrade to a no-op rather than inventing data out of thin air.
    nextItems = items;
  } else {
    nextItems = items;
    for (let i = 0; i < amount; i++) {
      nextItems = [...nextItems, smartDuplicateArrayItem(items[i % items.length], nextItems)];
    }
  }

  const delta = nextItems.length - items.length;
  const result: Record<string, unknown> = { ...value, items: nextItems };

  if (shape === 'gg-like') {
    result['totalHits'] = (value['totalHits'] as number) + delta;
    result['totalPageCount'] = Math.max(
      1,
      Math.ceil((result['totalHits'] as number) / ((value['itemsPerPage'] as number) || 1)),
    );
  } else if (shape === 'dyn-like') {
    result['totalHits'] = (value['totalHits'] as number) + delta;
    result['totalPages'] = Math.max(1, Math.ceil((result['totalHits'] as number) / ((value['limit'] as number) || 1)));
  } else if (shape === 'normalized') {
    result['totalHits'] = (value['totalHits'] as number) + delta;
    result['totalPages'] = Math.max(
      1,
      Math.ceil((result['totalHits'] as number) / ((value['itemsPerPage'] as number) || 1)),
    );
  } else {
    result['total'] = (value['total'] as number) + delta;
  }

  return result;
};

const STRING_PRESETS = {
  short: 'Ab',
  long: /* @__PURE__ */ 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt. '.repeat(
    4,
  ),
  longWord: 'Rindfleischetikettierungsüberwachungsaufgabenübertragungsgesetz',
  unicode: 'مرحبا بالعالم 👋 日本語テスト 🎉 Ñoño',
} as const;

const stringPresetValue = (preset: 'short' | 'long' | 'longWord' | 'unicode' | 'custom', custom: string | undefined) =>
  custom ?? (preset === 'custom' ? '' : STRING_PRESETS[preset]);

const NUMBER_PRESETS = {
  zero: 0,
  negative: -1,
  huge: Number.MAX_SAFE_INTEGER,
} as const;

const numberPresetValue = (preset: 'zero' | 'negative' | 'huge' | 'custom', custom: number | undefined) =>
  custom ?? (preset === 'custom' ? 0 : NUMBER_PRESETS[preset]);

const pickRandom = <T>(values: readonly T[]) => values[Math.floor(Math.random() * values.length)] as T;

const randomIntBetween = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));

const randomHex = (length: number) => {
  let out = '';
  while (out.length < length) out += Math.random().toString(16).slice(2);
  return out.slice(0, length);
};

const SHORT_WORDS = ['Ok', 'Ada', 'Fig', 'Kiwi', 'Nova', 'Echo', 'Amber', 'Delta', 'Mango', 'Quartz', 'Zephyr'];

const LOREM_SENTENCE =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ';

const LONG_COMPOUNDS = [
  'Rindfleischetikettierungsüberwachungsaufgabenübertragungsgesetz',
  'Donaudampfschifffahrtsgesellschaftskapitänskajütenschlüssel',
  'Kraftfahrzeughaftpflichtversicherungsbescheinigung',
];

const UNICODE_SAMPLES = [
  'مرحبا بالعالم 👋 اختبار النص',
  '日本語テスト 🎉 カタカナとひらがな',
  '한국어 테스트 💡 조합형 한글',
  'עברית מימין לשמאל 🚀 בדיקה',
  'Ñoño über façade — Ω≈ç√∫ 🧪',
];

/**
 * Generates a fresh sample value for a string preset, so filling twenty fields yields twenty different
 * values instead of twenty identical ones. Call it at arm time and store the result in the op's
 * `custom` field - generating inside apply would reshuffle the response on every refetch. `longWord`
 * is a single unbreakable token (a compound word, a URL, a hex blob) - it tests overflow, where
 * `long` tests wrapping.
 */
export const generateQueryDevtoolsStringPreset = (preset: 'short' | 'long' | 'longWord' | 'unicode') => {
  switch (preset) {
    case 'short':
      return pickRandom(SHORT_WORDS);
    case 'long': {
      const length = randomIntBetween(80, 480);
      return LOREM_SENTENCE.repeat(Math.ceil(length / LOREM_SENTENCE.length))
        .slice(0, length)
        .trimEnd();
    }
    case 'longWord':
      return pickRandom([
        () => pickRandom(LONG_COMPOUNDS),
        () =>
          `https://api.example.com/v2/resources/${randomHex(24)}/attachments?signature=${randomHex(randomIntBetween(24, 96))}`,
        () => randomHex(randomIntBetween(64, 160)),
      ])();
    case 'unicode':
      return pickRandom(UNICODE_SAMPLES);
  }
};

/**
 * Generates a fresh sample value for a number preset - same arm-time contract as
 * {@link generateQueryDevtoolsStringPreset}. `negative` and `huge` vary in magnitude so a batch fill
 * produces varied digit counts; `zero` is always `0`.
 */
export const generateQueryDevtoolsNumberPreset = (preset: 'zero' | 'negative' | 'huge') => {
  switch (preset) {
    case 'zero':
      return 0;
    case 'negative': {
      const magnitude = 10 ** randomIntBetween(0, 8);
      return -randomIntBetween(magnitude, magnitude * 10 - 1);
    }
    case 'huge': {
      const magnitude = 10 ** randomIntBetween(9, 15);
      return Math.min(randomIntBetween(magnitude, magnitude * 10 - 1), Number.MAX_SAFE_INTEGER);
    }
  }
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** `invalid` is deliberately unparseable - "the API sent a date my code can't parse" is a real bug class. */
const datePresetValue = (preset: 'now' | 'plusDay' | 'minusDay' | 'farFuture' | 'farPast' | 'invalid') => {
  switch (preset) {
    case 'now':
      return new Date().toISOString();
    case 'plusDay':
      return new Date(Date.now() + DAY_MS).toISOString();
    case 'minusDay':
      return new Date(Date.now() - DAY_MS).toISOString();
    case 'farFuture':
      return new Date('2099-01-01T00:00:00.000Z').toISOString();
    case 'farPast':
      return new Date(0).toISOString();
    case 'invalid':
      return 'not-a-date';
  }
};

const applyOp = (root: unknown, op: OverrideOp): { root: unknown; ok: boolean } => {
  if (op.type === 'reset') return { root, ok: true };

  const resolution = resolvePath(root, op.path);
  if (!resolution.ok) return { root, ok: false };

  switch (op.type) {
    case 'set':
      return { root: withValueAtPath(root, op.path, op.value), ok: true };

    case 'booleanFlip':
      if (!resolution.exists || typeof resolution.value !== 'boolean') return { root, ok: false };
      return { root: withValueAtPath(root, op.path, !resolution.value), ok: true };

    case 'stringPreset':
      if (!resolution.exists) return { root, ok: false };
      return { root: withValueAtPath(root, op.path, stringPresetValue(op.preset, op.custom)), ok: true };

    case 'numberPreset':
      if (!resolution.exists) return { root, ok: false };
      return { root: withValueAtPath(root, op.path, numberPresetValue(op.preset, op.custom)), ok: true };

    case 'datePreset':
      if (!resolution.exists) return { root, ok: false };
      return { root: withValueAtPath(root, op.path, datePresetValue(op.preset)), ok: true };

    case 'duplicateArrayItem':
      if (!Array.isArray(resolution.value) || op.index < 0 || op.index >= resolution.value.length) {
        return { root, ok: false };
      }
      return { root: withValueAtPath(root, op.path, duplicateOneArrayItem(resolution.value, op.index)), ok: true };

    case 'pasteArrayItem': {
      if (!Array.isArray(resolution.value)) return { root, ok: false };

      const next = [...resolution.value];
      const at = op.index === undefined ? next.length : Math.min(Math.max(0, op.index), next.length);
      next.splice(at, 0, op.value);

      return { root: withValueAtPath(root, op.path, next), ok: true };
    }

    case 'deleteAt':
      // The response root has no parent to be removed from, and a key that is already gone stays gone.
      if (!op.path.length || !resolution.exists) return { root, ok: false };
      return { root: withoutValueAtPath(root, op.path), ok: true };

    case 'duplicateArray':
      if (!Array.isArray(resolution.value)) return { root, ok: false };
      return { root: withValueAtPath(root, op.path, duplicateWholeArray(resolution.value)), ok: true };

    case 'paginationResize': {
      const shape = detectPaginationShape(resolution.value);
      if (!shape) return { root, ok: false };
      return {
        root: withValueAtPath(
          root,
          op.path,
          resizePagination(resolution.value as Record<string, unknown>, shape, op.mode, op.amount),
        ),
        ok: true,
      };
    }
  }
};

/**
 * Replays `entries` against `raw`, in order, and reports which ones no longer resolve. Shared by the
 * pipeline (which only needs {@link value}) and the panel's menu (which previews a value and marks stale
 * ops before arming a new one) - one implementation, so the two cannot drift.
 */
export const applyQueryDevtoolsOverrides = (
  entries: readonly QueryDevtoolsOverrideEntry[],
  raw: unknown,
): { value: unknown; staleIds: string[] } => {
  let root = raw;
  const staleIds: string[] = [];

  for (const entry of entries) {
    const applied = applyOp(root, entry.op);
    root = applied.root;
    if (!applied.ok) staleIds.push(entry.id);
  }

  return { value: root, staleIds };
};

/**
 * Accumulates the response overrides armed on one query, for the devtools panel. Only ever created
 * while {@link provideQueryDevtools} is installed - like {@link createQueryDevtoolsStats}, an app
 * without devtools pays nothing for it.
 * @internal
 */
export const createQueryDevtoolsOverrides = (): QueryDevtoolsOverridesRecorder => {
  const list = signal<QueryDevtoolsOverrideEntry[]>([]);
  let counter = 0;

  const arm = (op: OverrideOp) => {
    if (op.type === 'reset') {
      list.update((current) => current.filter((entry) => !isPathAtOrBelow(entry.op.path, op.path)));

      return;
    }

    list.update((current) => [...current, { id: `override-${++counter}`, op }]);
  };

  const clear = (id: string) => list.update((current) => current.filter((entry) => entry.id !== id));
  const clearAll = () => list.set([]);
  const apply = (raw: unknown) => applyQueryDevtoolsOverrides(list(), raw).value;

  return { list: list.asReadonly(), arm, clear, clearAll, apply };
};
