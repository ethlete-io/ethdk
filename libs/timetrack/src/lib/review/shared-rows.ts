import { manualEvidence } from './edits';
import { DayReviewEdits, PinnedRow, SharedStamp } from './model';

/** A row the reviewer wrote by hand, as it travels: no evidence and no stand-in, its lane in the sender's checkout. */
export type SharedManualRow = {
  issueKey?: string;
  storyKey?: string;
  from: Date;
  to: Date;
  durationMs: number;
  laneKey?: string;
  description: string;
  state?: 'accepted' | 'rejected';
  hidden?: boolean;
};

/** One subject of a day a machine shares with its paired machines, stamped in the sender's clock. */
export type SharedEntry = { id: string; atMs: number } & (
  { kind: 'manual-row'; row: SharedManualRow } | { kind: 'deleted' }
);

/** A paired machine's shared entries of a day and how far its clock is ahead of this one's. */
export type PeerSharedEntries = { entries: readonly SharedEntry[]; clockOffsetMs: number };

const isSharedManualRow = (row: PinnedRow) =>
  row.replaces.length === 0 && row.evidence.some((entry) => entry.kind === 'manual');

const manualRowsOf = (edits: DayReviewEdits) =>
  new Map(edits.pinned.filter(isSharedManualRow).map((row) => [row.id, row]));

const sharedRowOf = (row: PinnedRow): SharedManualRow => ({
  ...(row.issueKey ? { issueKey: row.issueKey } : {}),
  ...(row.storyKey ? { storyKey: row.storyKey } : {}),
  from: row.from,
  to: row.to,
  durationMs: row.durationMs,
  ...(row.laneKey ? { laneKey: row.laneKey } : {}),
  description: row.description,
  ...(row.state ? { state: row.state } : {}),
  ...(row.hidden ? { hidden: true } : {}),
});

const wireRowOf = (row: SharedManualRow) => ({ ...row, from: row.from.getTime(), to: row.to.getTime() });

const sameRow = (left: SharedManualRow, right: SharedManualRow) =>
  JSON.stringify(wireRowOf(left)) === JSON.stringify(wireRowOf(right));

const pinnedOf = (id: string, row: SharedManualRow): PinnedRow => ({
  id,
  replaces: [],
  ...(row.issueKey ? { issueKey: row.issueKey } : {}),
  ...(row.storyKey ? { storyKey: row.storyKey } : {}),
  from: row.from,
  to: row.to,
  durationMs: row.durationMs,
  observedMs: 0,
  ...(row.laneKey ? { laneKey: row.laneKey } : {}),
  description: row.description,
  confidence: 'certain',
  evidence: manualEvidence(row),
  ...(row.state ? { state: row.state } : {}),
  ...(row.hidden ? { hidden: true } : {}),
});

/**
 * `after` with every hand-written row that was added, changed or removed since `before` stamped at `atMs`,
 * so a paired machine can tell which side changed it last. Returns `after` when no such row changed.
 */
export const stampSharedEdits = (options: {
  before: DayReviewEdits;
  after: DayReviewEdits;
  atMs: number;
}): DayReviewEdits => {
  const was = manualRowsOf(options.before);
  const now = manualRowsOf(options.after);
  const changed: Record<string, SharedStamp> = {};

  for (const [id, row] of now) {
    const old = was.get(id);

    if (!old || !sameRow(sharedRowOf(old), sharedRowOf(row))) changed[id] = { atMs: options.atMs };
  }

  for (const id of was.keys()) {
    if (!now.has(id)) changed[id] = { atMs: options.atMs, deleted: true };
  }

  if (!Object.keys(changed).length) return options.after;

  return { ...options.after, stamps: { ...options.after.stamps, ...changed } };
};

/** What this machine shares of a day: its hand-written rows and the ones it removed. A row never stamped counts as oldest. */
export const sharedEntriesOf = (edits: DayReviewEdits): SharedEntry[] => {
  const rows = manualRowsOf(edits);
  const stamps = edits.stamps ?? {};

  return [
    ...[...rows].map(([id, row]): SharedEntry => ({
      id,
      atMs: stamps[id]?.atMs ?? 0,
      kind: 'manual-row',
      row: sharedRowOf(row),
    })),
    ...Object.entries(stamps)
      .filter(([id, stamp]) => stamp.deleted && !rows.has(id))
      .map(([id, stamp]): SharedEntry => ({ id, atMs: stamp.atMs, kind: 'deleted' })),
  ];
};

/**
 * `edits` with what the paired machines changed later than this machine: the latest stamp wins once each
 * peer's stamp is moved onto this machine's clock (ADR 0041 pt 2), and a tie keeps this machine's version.
 * Returns `edits` when no peer changed anything.
 */
export const withPeerSharedEntries = (options: {
  edits: DayReviewEdits;
  peers: readonly PeerSharedEntries[];
}): DayReviewEdits => {
  const latest = new Map<string, SharedEntry>();

  for (const peer of options.peers) {
    for (const entry of peer.entries) {
      const atMs = entry.atMs - peer.clockOffsetMs;
      const held = latest.get(entry.id);

      if (!held || atMs > held.atMs) latest.set(entry.id, { ...entry, atMs });
    }
  }

  const ownIds = new Set(options.edits.pinned.filter((row) => !isSharedManualRow(row)).map((row) => row.id));
  const rows = manualRowsOf(options.edits);
  const stamps = options.edits.stamps ?? {};
  const changed: Record<string, SharedStamp> = {};
  const replaced = new Map<string, PinnedRow | null>();

  for (const [id, entry] of latest) {
    if (ownIds.has(id)) continue;

    const local = rows.get(id);
    const localAtMs = stamps[id]?.atMs ?? (local ? 0 : -Infinity);

    if (entry.atMs <= localAtMs) continue;

    if (entry.kind === 'deleted') {
      if (!local && stamps[id]?.deleted) continue;

      replaced.set(id, null);
      changed[id] = { atMs: entry.atMs, deleted: true };
    } else {
      if (local && sameRow(sharedRowOf(local), entry.row)) continue;

      replaced.set(id, pinnedOf(id, entry.row));
      changed[id] = { atMs: entry.atMs };
    }
  }

  if (!Object.keys(changed).length) return options.edits;

  const kept = options.edits.pinned.flatMap((row) => {
    if (!replaced.has(row.id) || ownIds.has(row.id)) return [row];

    const next = replaced.get(row.id);

    return next ? [next] : [];
  });
  const added = [...replaced].flatMap(([id, row]) => (row && !rows.has(id) ? [row] : []));

  return { ...options.edits, pinned: [...kept, ...added], stamps: { ...stamps, ...changed } };
};

/** The wire form of {@link SharedEntry}. */
export const encodeSharedEntry = (entry: SharedEntry) =>
  entry.kind === 'manual-row' ? { ...entry, row: wireRowOf(entry.row) } : entry;

const textOf = (value: unknown) => (typeof value === 'string' && value.length > 0 ? value : undefined);

const sharedRowFrom = (value: unknown): SharedManualRow | null => {
  if (typeof value !== 'object' || value === null) return null;

  const record = value as Record<string, unknown>;
  const { from, to, durationMs, state } = record;

  if (typeof from !== 'number' || typeof to !== 'number' || to <= from) return null;
  if (typeof durationMs !== 'number' || durationMs <= 0) return null;

  const issueKey = textOf(record['issueKey']);
  const storyKey = textOf(record['storyKey']);
  const laneKey = textOf(record['laneKey']);

  return {
    ...(issueKey ? { issueKey } : {}),
    ...(storyKey ? { storyKey } : {}),
    from: new Date(from),
    to: new Date(to),
    durationMs,
    ...(laneKey ? { laneKey } : {}),
    description: typeof record['description'] === 'string' ? record['description'] : '',
    ...(state === 'accepted' || state === 'rejected' ? { state } : {}),
    ...(record['hidden'] === true ? { hidden: true } : {}),
  };
};

/** A shared entry read field by field, `null` for what no version of this app wrote. */
export const parseSharedEntry = (value: unknown): SharedEntry | null => {
  if (typeof value !== 'object' || value === null) return null;

  const record = value as Record<string, unknown>;
  const id = textOf(record['id']);
  const atMs = record['atMs'];

  if (!id || typeof atMs !== 'number') return null;
  if (record['kind'] === 'deleted') return { id, atMs, kind: 'deleted' };
  if (record['kind'] !== 'manual-row') return null;

  const row = sharedRowFrom(record['row']);

  return row ? { id, atMs, kind: 'manual-row', row } : null;
};
