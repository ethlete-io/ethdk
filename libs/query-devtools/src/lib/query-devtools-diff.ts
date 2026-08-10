/** Whether a path exists only in the newer value, only in the older one, or in both with a new value. */
export type QueryDevtoolsDiffKind = 'added' | 'removed' | 'changed';

/** One difference between two values, located by the path it sits at. */
export type QueryDevtoolsDiffEntry = {
  /** Where the difference sits, e.g. `$.items[2].score` or `$.items[id=7].score`. */
  path: string;

  kind: QueryDevtoolsDiffKind;

  /** The older value, or `null` for an added path. */
  before: unknown;

  /** The newer value, or `null` for a removed path. */
  after: unknown;
};

export type QueryDevtoolsDiff = {
  entries: QueryDevtoolsDiffEntry[];

  /** Whether the walk hit its cap, so {@link entries} is only part of the difference. */
  truncated: boolean;
};

/** Enough to describe what changed between two responses; past this the list stops being readable. */
const MAX_ENTRIES = 200;

/**
 * How deep the walk descends before comparing whole subtrees at once. Guards against a self-referential
 * response, and keeps a deeply nested change reported as one entry rather than a path per level.
 */
const MAX_DEPTH = 12;

/** Stands in for a path one side does not have, so a stored `undefined` is not mistaken for a missing key. */
const ABSENT = /* @__PURE__ */ Symbol('absent');

type DiffAccumulator = { entries: QueryDevtoolsDiffEntry[]; truncated: boolean };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const valueAt = (record: Record<string, unknown>, key: string): unknown => (key in record ? record[key] : ABSENT);

/**
 * The `id` of every element, when an array holds records keyed by a unique primitive `id` - the shape an
 * API list almost always has. `null` for anything else, which is then compared by index.
 */
const recordIds = (items: unknown[]) => {
  const ids: (string | number)[] = [];

  for (const item of items) {
    if (!isRecord(item)) return null;

    const id = item['id'];

    if (typeof id !== 'string' && typeof id !== 'number') return null;

    ids.push(id);
  }

  return new Set(ids).size === ids.length ? ids : null;
};

/**
 * Whether two values are the same, for the leaves and for the subtrees the walk stopped descending into.
 * The serialized comparison is key-order sensitive, which only ever over-reports a difference.
 */
const isSameValue = (before: unknown, after: unknown) => {
  if (Object.is(before, after)) return true;
  if (!isRecord(before) && !Array.isArray(before)) return false;
  if (!isRecord(after) && !Array.isArray(after)) return false;

  try {
    return JSON.stringify(before) === JSON.stringify(after);
  } catch {
    return false;
  }
};

const push = (acc: DiffAccumulator, entry: QueryDevtoolsDiffEntry) => {
  if (acc.entries.length >= MAX_ENTRIES) {
    acc.truncated = true;

    return;
  }

  acc.entries.push(entry);
};

/**
 * Appends one step to a path in the panel's canonical JSONPath format - `$.data.items[0]`, rooted at
 * `$` for the value an explorer or a diff was handed. The one place that format is written, so the
 * diff's Path column and the value explorer's "Copy path" cannot drift apart.
 */
export const appendJsonPathStep = (path: string, step: string | number) =>
  typeof step === 'number' ? `${path}[${step}]` : `${path}.${step}`;

/** The same format, built from the array of steps an override op targets. */
export const formatJsonPath = (steps: readonly (string | number)[]) => steps.reduce(appendJsonPathStep, '$');

/** One position in the walk: the two values to compare there, and how deep into them it is. */
type WalkStep<T = unknown> = {
  before: T;
  after: T;
  path: string;
  depth: number;
};

const walk = ({ before, after, path, depth }: WalkStep, acc: DiffAccumulator) => {
  if (acc.truncated) return;

  if (before === ABSENT) {
    push(acc, { path, kind: 'added', before: null, after });

    return;
  }

  if (after === ABSENT) {
    push(acc, { path, kind: 'removed', before, after: null });

    return;
  }

  if (depth < MAX_DEPTH) {
    if (isRecord(before) && isRecord(after)) {
      for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
        walk(
          {
            before: valueAt(before, key),
            after: valueAt(after, key),
            path: appendJsonPathStep(path, key),
            depth: depth + 1,
          },
          acc,
        );
      }

      return;
    }

    if (Array.isArray(before) && Array.isArray(after)) {
      walkArrays({ before, after, path, depth }, acc);

      return;
    }
  }

  if (!isSameValue(before, after)) push(acc, { path, kind: 'changed', before, after });
};

const walkArrays = ({ before, after, path, depth }: WalkStep<unknown[]>, acc: DiffAccumulator) => {
  const beforeIds = recordIds(before);
  const afterIds = recordIds(after);
  const nested = depth + 1;

  // Matching records by their `id` keeps a list that gained or lost an item reported as that one item,
  // instead of every index after it shifting and reading as changed.
  if (beforeIds && afterIds) {
    const afterById = new Map(afterIds.map((id, index) => [id, after[index]]));
    const beforeIdSet = new Set(beforeIds);

    beforeIds.forEach((id, index) => {
      const paired = afterById.has(id) ? afterById.get(id) : ABSENT;

      walk({ before: before[index], after: paired, path: `${path}[id=${id}]`, depth: nested }, acc);
    });

    afterIds.forEach((id, index) => {
      if (beforeIdSet.has(id)) return;

      walk({ before: ABSENT, after: after[index], path: `${path}[id=${id}]`, depth: nested }, acc);
    });

    return;
  }

  for (let index = 0; index < Math.max(before.length, after.length); index++) {
    walk(
      {
        before: index < before.length ? before[index] : ABSENT,
        after: index < after.length ? after[index] : ABSENT,
        path: appendJsonPathStep(path, index),
        depth: nested,
      },
      acc,
    );
  }
};

/**
 * What changed between two responses of the same query, as a flat list of paths - the shape that answers
 * "the list re-rendered, what changed?" and "did that poll return anything new?".
 */
export const diffQueryDevtoolsResponses = (before: unknown, after: unknown): QueryDevtoolsDiff => {
  const acc: DiffAccumulator = { entries: [], truncated: false };

  walk({ before, after, path: '$', depth: 0 }, acc);

  return acc;
};
