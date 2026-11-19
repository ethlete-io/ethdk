import { Confidence } from '../model/evidence';
import { FieldSource, RowFieldSources } from '../model/field-source';
import { manualEvidence } from './edits';
import { DayReviewEdits, PinnedRow, ProposalOverride, SharedStamp } from './model';

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

/**
 * A row the reviewer built out of engine rows by a cut, merge, move or resize, as it travels: the engine
 * row ids it replaces, no evidence and no stand-in.
 */
export type SharedBuiltRow = SharedManualRow & {
  replaces: string[];
  observedMs: number;
  confidence: Confidence;
  tracksFrom?: boolean;
  tracksTo?: boolean;
  snippedFromMs?: number;
  cutAwayMs?: { fromMs: number; toMs: number }[];
  excluded?: boolean;
  unattended?: boolean;
  withheldIssueKey?: string;
  sources?: RowFieldSources;
};

/** A reviewer's change to an engine row (name, description, decision, hidden), as it travels: no stand-in. */
export type SharedOverride = Pick<
  ProposalOverride,
  'issueKey' | 'laneKey' | 'description' | 'state' | 'hidden' | 'sources'
>;

/** One subject of a day a machine shares with its paired machines, stamped in the sender's clock. */
export type SharedEntry = { id: string; atMs: number } & (
  | { kind: 'manual-row'; row: SharedManualRow }
  | { kind: 'built-row'; row: SharedBuiltRow }
  | { kind: 'row-edit'; override: SharedOverride }
  | { kind: 'deleted' }
);

/** A paired machine's shared entries of a day and how far its clock is ahead of this one's. */
export type PeerSharedEntries = { entries: readonly SharedEntry[]; clockOffsetMs: number };

type LiveEntry = Exclude<SharedEntry, { kind: 'deleted' }>;

const isSharedManualRow = (row: PinnedRow) =>
  row.replaces.length === 0 && row.evidence.some((entry) => entry.kind === 'manual');

const isBuiltRow = (row: PinnedRow) => row.replaces.length > 0;

const defined = <T extends object>(value: T): T =>
  Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;

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

const sharedBuiltRowOf = (row: PinnedRow): SharedBuiltRow => ({
  ...sharedRowOf(row),
  ...defined({
    replaces: [...row.replaces],
    observedMs: row.observedMs,
    confidence: row.confidence,
    tracksFrom: row.tracksFrom,
    tracksTo: row.tracksTo,
    snippedFromMs: row.snippedFromMs,
    cutAwayMs: row.cutAwayMs?.length ? row.cutAwayMs : undefined,
    excluded: row.excluded || undefined,
    unattended: row.unattended || undefined,
    withheldIssueKey: row.withheldIssueKey,
    sources: row.sources && Object.keys(row.sources).length ? row.sources : undefined,
  }),
});

const sharedOverrideOf = (override: ProposalOverride): SharedOverride | null => {
  const shared = defined<SharedOverride>({
    issueKey: override.issueKey,
    laneKey: override.laneKey,
    description: override.description,
    state: override.state,
    hidden: override.hidden || undefined,
    sources: override.sources && Object.keys(override.sources).length ? override.sources : undefined,
  });

  return Object.keys(shared).length ? shared : null;
};

const liveEntriesOf = (edits: DayReviewEdits): Map<string, LiveEntry> => {
  const live = new Map<string, LiveEntry>();

  for (const row of edits.pinned) {
    if (isSharedManualRow(row)) live.set(row.id, { id: row.id, atMs: 0, kind: 'manual-row', row: sharedRowOf(row) });
    else if (isBuiltRow(row)) live.set(row.id, { id: row.id, atMs: 0, kind: 'built-row', row: sharedBuiltRowOf(row) });
  }

  for (const [id, override] of Object.entries(edits.overrides)) {
    const shared = sharedOverrideOf(override);

    if (shared && !live.has(id)) live.set(id, { id, atMs: 0, kind: 'row-edit', override: shared });
  }

  return live;
};

const wireRowOf = <T extends SharedManualRow>(row: T) => ({ ...row, from: row.from.getTime(), to: row.to.getTime() });

/** The wire form of {@link SharedEntry}. */
export const encodeSharedEntry = (entry: SharedEntry) =>
  entry.kind === 'manual-row' || entry.kind === 'built-row' ? { ...entry, row: wireRowOf(entry.row) } : entry;

const bodyOf = (entry: SharedEntry) => {
  const { id: _id, atMs: _atMs, ...body } = encodeSharedEntry(entry);

  return JSON.stringify(body);
};

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

const builtPinnedOf = (options: { id: string; row: SharedBuiltRow; local?: PinnedRow }): PinnedRow => {
  const { row, local } = options;

  return {
    ...row,
    id: options.id,
    replaces: [...row.replaces],
    evidence: local?.evidence ?? [],
    ...(local?.standInId && !row.issueKey ? { standInId: local.standInId } : {}),
    ...(local?.workedOn ? { workedOn: local.workedOn } : {}),
  };
};

const localOnlyOf = (override: ProposalOverride | undefined, shared?: SharedOverride): ProposalOverride | null =>
  override?.standInId && !shared?.issueKey ? { standInId: override.standInId } : null;

/**
 * `after` with every shared subject that was added, changed or removed since `before` stamped at `atMs`,
 * so a paired machine can tell which side changed it last: hand-written rows, rows built by a cut, merge,
 * move or resize, and the edits of engine rows. Returns `after` when nothing shared changed.
 */
export const stampSharedEdits = (options: {
  before: DayReviewEdits;
  after: DayReviewEdits;
  atMs: number;
}): DayReviewEdits => {
  const was = liveEntriesOf(options.before);
  const now = liveEntriesOf(options.after);
  const changed: Record<string, SharedStamp> = {};

  for (const [id, entry] of now) {
    const old = was.get(id);

    if (!old || bodyOf(old) !== bodyOf(entry)) changed[id] = { atMs: options.atMs };
  }

  for (const id of was.keys()) {
    if (!now.has(id)) changed[id] = { atMs: options.atMs, deleted: true };
  }

  if (!Object.keys(changed).length) return options.after;

  return { ...options.after, stamps: { ...options.after.stamps, ...changed } };
};

/** What this machine shares of a day: its shared subjects and the ones it removed. A subject never stamped counts as oldest. */
export const sharedEntriesOf = (edits: DayReviewEdits): SharedEntry[] => {
  const live = liveEntriesOf(edits);
  const stamps = edits.stamps ?? {};

  return [
    ...[...live.values()].map((entry): SharedEntry => ({ ...entry, atMs: stamps[entry.id]?.atMs ?? 0 })),
    ...Object.entries(stamps)
      .filter(([id, stamp]) => stamp.deleted && !live.has(id))
      .map(([id, stamp]): SharedEntry => ({ id, atMs: stamp.atMs, kind: 'deleted' })),
  ];
};

const overlaps = (left: readonly string[], right: readonly string[]) => left.some((id) => right.includes(id));

/**
 * `edits` with what the paired machines changed later than this machine: the latest stamp wins once each
 * peer's stamp is moved onto this machine's clock (ADR 0041 pt 2), and a tie keeps this machine's version.
 * A peer's built row whose engine rows this machine built differently, later, is left out; one built later
 * than this machine's takes their place. Returns `edits` when no peer changed anything.
 */
export const withPeerSharedEntries = (options: {
  edits: DayReviewEdits;
  peers: readonly PeerSharedEntries[];
}): DayReviewEdits => {
  const { edits } = options;
  const latest = new Map<string, SharedEntry>();

  for (const peer of options.peers) {
    for (const entry of peer.entries) {
      const atMs = entry.atMs - peer.clockOffsetMs;
      const held = latest.get(entry.id);

      if (!held || atMs > held.atMs) latest.set(entry.id, { ...entry, atMs });
    }
  }

  const live = liveEntriesOf(edits);
  const pinnedById = new Map(edits.pinned.map((row) => [row.id, row]));
  const unshared = new Set(edits.pinned.filter((row) => !live.has(row.id)).map((row) => row.id));
  const stamps = edits.stamps ?? {};
  const changed: Record<string, SharedStamp> = {};
  const rows = new Map<string, PinnedRow | null>();
  const overrides = new Map<string, ProposalOverride | null>();

  for (const [id, entry] of latest) {
    if (unshared.has(id)) continue;

    const local = live.get(id);
    const localAtMs = stamps[id]?.atMs ?? (local ? 0 : -Infinity);

    if (entry.atMs <= localAtMs) continue;

    if (entry.kind === 'deleted') {
      if (!local && stamps[id]?.deleted) continue;
      if (pinnedById.has(id)) rows.set(id, null);
      if (edits.overrides[id]) overrides.set(id, localOnlyOf(edits.overrides[id]));

      changed[id] = { atMs: entry.atMs, deleted: true };
      continue;
    }

    if (local && bodyOf(local) === bodyOf(entry)) continue;

    if (entry.kind === 'row-edit') {
      if (pinnedById.has(id)) continue;

      overrides.set(id, { ...localOnlyOf(edits.overrides[id], entry.override), ...entry.override });
    } else if (entry.kind === 'manual-row') {
      rows.set(id, pinnedOf(id, entry.row));
    } else {
      rows.set(id, builtPinnedOf({ id, row: entry.row, local: pinnedById.get(id) }));
    }

    changed[id] = { atMs: entry.atMs };
  }

  const peerHeld = new Set([...latest].filter(([, entry]) => entry.kind !== 'deleted').map(([id]) => id));

  for (const [id, row] of [...rows]) {
    if (!row || !isBuiltRow(row)) continue;

    const atMs = changed[id]?.atMs ?? 0;
    const rivals = edits.pinned.filter(
      (other) =>
        isBuiltRow(other) && !peerHeld.has(other.id) && !rows.has(other.id) && overlaps(other.replaces, row.replaces),
    );

    if (rivals.some((other) => (stamps[other.id]?.atMs ?? 0) >= atMs)) {
      rows.delete(id);
      delete changed[id];
      continue;
    }

    for (const other of rivals) {
      rows.set(other.id, null);
      changed[other.id] = { atMs, deleted: true };
    }
  }

  if (!Object.keys(changed).length) return edits;

  const kept = edits.pinned.flatMap((row) => {
    if (!rows.has(row.id)) return [row];

    const next = rows.get(row.id);

    return next ? [next] : [];
  });
  const added = [...rows].flatMap(([id, row]) => (row && !pinnedById.has(id) ? [row] : []));
  const nextOverrides = { ...edits.overrides };

  for (const [id, override] of overrides) {
    if (override) nextOverrides[id] = override;
    else delete nextOverrides[id];
  }

  return {
    ...edits,
    overrides: nextOverrides,
    pinned: [...kept, ...added],
    stamps: { ...stamps, ...changed },
  };
};

const textOf = (value: unknown) => (typeof value === 'string' && value.length > 0 ? value : undefined);

const SOURCES: readonly FieldSource[] = ['human', 'auto', 'observed'];

const sourcesFrom = (value: unknown): RowFieldSources | undefined => {
  if (typeof value !== 'object' || value === null) return undefined;

  const record = value as Record<string, unknown>;
  const issue = SOURCES.find((source) => source === record['issue']);
  const description = SOURCES.find((source) => source === record['description']);
  const sources = defined<RowFieldSources>({ issue, description });

  return Object.keys(sources).length ? sources : undefined;
};

const stateFrom = (value: unknown) => (value === 'accepted' || value === 'rejected' ? value : undefined);

const sharedRowFrom = (value: unknown, minimumMs: number): SharedManualRow | null => {
  if (typeof value !== 'object' || value === null) return null;

  const record = value as Record<string, unknown>;
  const { from, to, durationMs } = record;

  if (typeof from !== 'number' || typeof to !== 'number' || to <= from) return null;
  if (typeof durationMs !== 'number' || durationMs < minimumMs) return null;

  const issueKey = textOf(record['issueKey']);
  const storyKey = textOf(record['storyKey']);
  const laneKey = textOf(record['laneKey']);
  const state = stateFrom(record['state']);

  return {
    ...(issueKey ? { issueKey } : {}),
    ...(storyKey ? { storyKey } : {}),
    from: new Date(from),
    to: new Date(to),
    durationMs,
    ...(laneKey ? { laneKey } : {}),
    description: typeof record['description'] === 'string' ? record['description'] : '',
    ...(state ? { state } : {}),
    ...(record['hidden'] === true ? { hidden: true } : {}),
  };
};

const CONFIDENCES: readonly Confidence[] = ['certain', 'likely', 'weak'];

const cutAwayFrom = (value: unknown) =>
  Array.isArray(value)
    ? value.flatMap((window: unknown) => {
        if (typeof window !== 'object' || window === null) return [];

        const { fromMs, toMs } = window as Record<string, unknown>;

        return typeof fromMs === 'number' && typeof toMs === 'number' && toMs > fromMs ? [{ fromMs, toMs }] : [];
      })
    : [];

const builtRowFrom = (value: unknown): SharedBuiltRow | null => {
  const row = sharedRowFrom(value, 0);

  if (!row) return null;

  const record = value as Record<string, unknown>;
  const replaces = Array.isArray(record['replaces'])
    ? record['replaces'].flatMap((id: unknown) => (textOf(id) ? [id as string] : []))
    : [];
  const { observedMs, tracksFrom, tracksTo, snippedFromMs } = record;
  const confidence = CONFIDENCES.find((known) => known === record['confidence']);

  if (!replaces.length || typeof observedMs !== 'number' || observedMs < 0 || !confidence) return null;

  const cutAwayMs = cutAwayFrom(record['cutAwayMs']);

  return {
    ...row,
    ...defined({
      replaces,
      observedMs,
      confidence,
      tracksFrom: typeof tracksFrom === 'boolean' ? tracksFrom : undefined,
      tracksTo: typeof tracksTo === 'boolean' ? tracksTo : undefined,
      snippedFromMs: typeof snippedFromMs === 'number' ? snippedFromMs : undefined,
      cutAwayMs: cutAwayMs.length ? cutAwayMs : undefined,
      excluded: record['excluded'] === true || undefined,
      unattended: record['unattended'] === true || undefined,
      withheldIssueKey: textOf(record['withheldIssueKey']),
      sources: sourcesFrom(record['sources']),
    }),
  };
};

const overrideFrom = (value: unknown): SharedOverride | null => {
  if (typeof value !== 'object' || value === null) return null;

  const record = value as Record<string, unknown>;
  const override = defined<SharedOverride>({
    issueKey: textOf(record['issueKey']),
    laneKey: textOf(record['laneKey']),
    description: typeof record['description'] === 'string' ? record['description'] : undefined,
    state: stateFrom(record['state']),
    hidden: record['hidden'] === true || undefined,
    sources: sourcesFrom(record['sources']),
  });

  return Object.keys(override).length ? override : null;
};

/** A shared entry read field by field, `null` for what no version of this app wrote. */
export const parseSharedEntry = (value: unknown): SharedEntry | null => {
  if (typeof value !== 'object' || value === null) return null;

  const record = value as Record<string, unknown>;
  const id = textOf(record['id']);
  const atMs = record['atMs'];

  if (!id || typeof atMs !== 'number') return null;

  switch (record['kind']) {
    case 'deleted':
      return { id, atMs, kind: 'deleted' };
    case 'manual-row': {
      const row = sharedRowFrom(record['row'], Number.MIN_VALUE);

      return row ? { id, atMs, kind: 'manual-row', row } : null;
    }
    case 'built-row': {
      const row = builtRowFrom(record['row']);

      return row ? { id, atMs, kind: 'built-row', row } : null;
    }
    case 'row-edit': {
      const override = overrideFrom(record['override']);

      return override ? { id, atMs, kind: 'row-edit', override } : null;
    }
    default:
      return null;
  }
};
