import {
  applyQueryDevtoolsOverrides,
  JsonPath,
  OverrideOp,
  QueryDevtoolsOverrideEntry,
  QueryDevtoolsOverridesRecorder,
} from './query-devtools-overrides';

const TRANSFER_KIND = 'ethlete-query-overrides';

const TRANSFER_VERSION = 1;

/**
 * A whole armed override set, as the devtools panel writes it to the clipboard: pretty-printed JSON so
 * it can be pasted onto another query, into a ticket, or hand-edited on the way. `source` is only ever
 * a human's bearing on where it came from - a paste never resolves against it.
 */
export type QueryDevtoolsOverrideTransfer = {
  kind: typeof TRANSFER_KIND;
  version: number;
  source?: { id?: string; url?: string };
  ops: OverrideOp[];
};

/** What {@link parseQueryDevtoolsOverrideTransfer} makes of a piece of clipboard text. */
export type QueryDevtoolsOverrideTransferParse =
  | {
      ok: true;
      ops: OverrideOp[];

      /** Ops the payload held that this build has no `type` for - a newer panel wrote them. */
      skipped: number;
      source?: { id?: string; url?: string };
    }
  | { ok: false; reason: string };

const OP_TYPES: ReadonlySet<string> = /* @__PURE__ */ new Set<OverrideOp['type']>([
  'set',
  'stringPreset',
  'numberPreset',
  'booleanFlip',
  'datePreset',
  'duplicateArrayItem',
  'pasteArrayItem',
  'deleteAt',
  'duplicateArray',
  'paginationResize',
  'reset',
]);

const isJsonPath = (value: unknown): value is JsonPath =>
  Array.isArray(value) && value.every((step) => typeof step === 'string' || typeof step === 'number');

const isOverrideOp = (value: unknown): value is OverrideOp => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;

  const op = value as { type?: unknown; path?: unknown };

  return typeof op.type === 'string' && OP_TYPES.has(op.type) && isJsonPath(op.path);
};

/**
 * Serializes the ops armed on one query into clipboard text. `reset` never reaches a recorder's list, so
 * what comes out is exactly what a paste can put back.
 */
export const serializeQueryDevtoolsOverrideTransfer = (
  entries: readonly QueryDevtoolsOverrideEntry[],
  source?: { id?: string; url?: string },
) => {
  const payload: QueryDevtoolsOverrideTransfer = {
    kind: TRANSFER_KIND,
    version: TRANSFER_VERSION,
    ...(source ? { source } : {}),
    ops: entries.map((entry) => entry.op),
  };

  return JSON.stringify(payload, null, 2);
};

/**
 * Reads clipboard text back into ops. A bare array of ops is accepted alongside the full envelope, so a
 * set pasted out of a ticket and trimmed by hand still lands; an op whose `type` this build doesn't know
 * is counted in `skipped` rather than failing the whole paste, so an older panel can take a newer one's
 * set minus the parts it cannot replay.
 */
export const parseQueryDevtoolsOverrideTransfer = (text: string): QueryDevtoolsOverrideTransferParse => {
  if (!text.trim()) return { ok: false, reason: 'The clipboard is empty' };

  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'The clipboard does not hold valid JSON' };
  }

  const envelope =
    !Array.isArray(parsed) && parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  const raw = Array.isArray(parsed) ? parsed : envelope?.['ops'];

  if (!Array.isArray(raw)) return { ok: false, reason: 'The clipboard does not hold a copied override set' };

  const ops = raw.filter(isOverrideOp);
  const skipped = raw.length - ops.length;

  if (!ops.length) {
    return { ok: false, reason: skipped ? 'None of those ops can be replayed by this build' : 'That set is empty' };
  }

  const source = envelope?.['source'];

  return {
    ok: true,
    ops,
    skipped,
    ...(source && typeof source === 'object' && !Array.isArray(source) ? { source: source as { id?: string } } : {}),
  };
};

/**
 * How many of `ops` would not resolve against `raw` - what a paste onto a differently-shaped query
 * reports, so ops sitting on nothing say so instead of looking armed. Replays them the same way the
 * pipeline will, since an earlier op can be what makes a later one's path exist.
 */
export const countUnresolvedQueryDevtoolsOverrides = (ops: readonly OverrideOp[], raw: unknown) =>
  applyQueryDevtoolsOverrides(
    ops.map((op, index) => ({ id: `${index}`, op })),
    raw,
  ).staleIds.length;

/** Arms every op of a parsed set onto a query, on top of whatever it already has armed. */
export const armQueryDevtoolsOverrideTransfer = (
  recorder: QueryDevtoolsOverridesRecorder,
  ops: readonly OverrideOp[],
) => {
  for (const op of ops) recorder.arm(op);
};
