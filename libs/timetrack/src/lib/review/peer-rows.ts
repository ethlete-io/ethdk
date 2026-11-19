import { streamKeyRepoPath } from '../model/block';
import { CheckoutKeys, translatePeerPath } from '../model/peer-path';
import { SyncedWorklog } from '../model/proposal';
import { DayReviewEdits, ReviewedRow } from './model';
import { SharedEntry, encodeSharedEntry, parseSharedEntry, sharedEntriesOf } from './shared-rows';

/** Where a row a paired machine sent stands there: booked to Tempo, decided by its reviewer, or proposed. */
export type PeerRowState = 'booked' | 'accepted' | 'suggested';

/** One row of a paired machine's day, as that machine reviewed it. It carries no evidence. */
export type PeerRow = {
  laneKey: string;
  from: Date;
  to: Date;
  issueKey?: string;
  /** The stand-in naming the row, while Jira holds no issue for the work. */
  standInName?: string;
  description: string;
  state: PeerRowState;
  /** The Tempo worklog a booked row was written as. */
  worklogId?: string;
};

/** A machine's rows of one day, sent to its paired machines whole; the last version sent wins. */
export type PeerDayRows = {
  day: string;
  frozen: boolean;
  rows: PeerRow[];
  /** The day's hand-written rows and removals, each stamped. Absent from a machine that predates them. */
  shared?: SharedEntry[];
};

const ACCEPTED_STATES: ReadonlySet<ReviewedRow['state']> = new Set(['accepted', 'edited', 'synced']);

/** The rows of a day this machine sends: the repository rows a person was at, unattended ones left out. */
export const peerDayRowsOf = (options: {
  day: string;
  frozen: boolean;
  rows: readonly ReviewedRow[];
  ledger: readonly SyncedWorklog[];
  standInNames: Readonly<Record<string, string>>;
  edits?: DayReviewEdits;
}): PeerDayRows => {
  const worklogs = new Map(options.ledger.map((entry) => [entry.proposalId, entry.tempoWorklogId]));

  return {
    day: options.day,
    frozen: options.frozen,
    ...(options.edits ? { shared: sharedEntriesOf(options.edits) } : {}),
    rows: options.rows.flatMap((row): PeerRow[] => {
      if (row.unattended || !row.laneKey || !streamKeyRepoPath(row.laneKey)) return [];

      const worklogId = worklogs.get(row.id);
      const standInName = row.standInId ? options.standInNames[row.standInId] : undefined;

      return [
        {
          laneKey: row.laneKey,
          from: row.from,
          to: row.to,
          ...(row.issueKey ? { issueKey: row.issueKey } : {}),
          ...(!row.issueKey && standInName ? { standInName } : {}),
          description: row.description,
          state: worklogId ? 'booked' : ACCEPTED_STATES.has(row.state) ? 'accepted' : 'suggested',
          ...(worklogId ? { worklogId } : {}),
        },
      ];
    }),
  };
};

/**
 * The version of the rows this app builds. Raise it when {@link peerDayRowsOf} or the rows it reads change
 * what a booked day sends: each machine then builds and sends its stored days again.
 */
export const PEER_DAY_ROWS_VERSION = 3;

/** The wire form of {@link PeerDayRows}, stamped with {@link PEER_DAY_ROWS_VERSION}. */
export const encodePeerDayRows = (rows: PeerDayRows) =>
  JSON.stringify({
    version: PEER_DAY_ROWS_VERSION,
    ...rows,
    rows: rows.rows.map((row) => ({ ...row, from: row.from.getTime(), to: row.to.getTime() })),
    ...(rows.shared ? { shared: rows.shared.map(encodeSharedEntry) } : {}),
  });

/** The version a wire form was built with, 0 for one written before rows carried a version. */
export const peerDayRowsVersionOf = (json: string) => {
  try {
    const parsed: unknown = JSON.parse(json);
    const version = typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>)['version'] : 0;

    return typeof version === 'number' ? version : 0;
  } catch {
    return 0;
  }
};

/** How many days back a machine builds the rows of its booked days. */
export const PEER_DAY_ROWS_BACKFILL_DAYS = 30;

/** The booked days whose rows this machine has not stored, or stored with an older version, oldest first. */
export const peerDayRowsToBackfill = (options: {
  bookedDays: readonly string[];
  stored: Readonly<Record<string, string>>;
}) =>
  [...new Set(options.bookedDays)]
    .filter((day) => {
      const stored = options.stored[day];

      return stored === undefined || peerDayRowsVersionOf(stored) < PEER_DAY_ROWS_VERSION;
    })
    .sort();

const STATES: readonly PeerRowState[] = ['booked', 'accepted', 'suggested'];

const textOf = (value: unknown) => (typeof value === 'string' && value.length > 0 ? value : undefined);

const peerRowOf = (value: unknown): PeerRow | null => {
  if (typeof value !== 'object' || value === null) return null;

  const record = value as Record<string, unknown>;
  const laneKey = textOf(record['laneKey']);
  const { from, to, state } = record;

  if (!laneKey || typeof from !== 'number' || typeof to !== 'number' || to <= from) return null;

  const issueKey = textOf(record['issueKey']);
  const standInName = textOf(record['standInName']);
  const worklogId = textOf(record['worklogId']);

  return {
    laneKey,
    from: new Date(from),
    to: new Date(to),
    ...(issueKey ? { issueKey } : {}),
    ...(standInName ? { standInName } : {}),
    description: typeof record['description'] === 'string' ? record['description'] : '',
    state: STATES.find((known) => known === state) ?? 'suggested',
    ...(worklogId ? { worklogId } : {}),
  };
};

/** A paired machine's day rows read field by field, `null` for what no version of this app wrote. */
export const parsePeerDayRows = (json: string): PeerDayRows | null => {
  try {
    const parsed: unknown = JSON.parse(json);

    if (typeof parsed !== 'object' || parsed === null) return null;

    const record = parsed as Record<string, unknown>;
    const day = textOf(record['day']);

    if (!day || !Array.isArray(record['rows'])) return null;

    return {
      day,
      frozen: record['frozen'] === true,
      rows: record['rows'].map(peerRowOf).filter((row): row is PeerRow => row !== null),
      ...(Array.isArray(record['shared'])
        ? { shared: record['shared'].map(parseSharedEntry).filter((entry) => entry !== null) }
        : {}),
    };
  } catch {
    return null;
  }
};

const isUnderCheckout = (path: string, localKeys: CheckoutKeys) =>
  Object.keys(localKeys).some((root) => {
    const trimmed = root.replace(/[\\/]+$/, '');

    return path === trimmed || path.startsWith(`${trimmed}/`) || path.startsWith(`${trimmed}\\`);
  });

const mapSharedEntry = (options: { entry: SharedEntry; peerKeys: CheckoutKeys; localKeys: CheckoutKeys }) => {
  const { entry } = options;

  if (entry.kind !== 'manual-row' || !entry.row.laneKey) return entry;

  const path = streamKeyRepoPath(entry.row.laneKey);

  if (path === undefined) return entry;

  const local = translatePeerPath({ path, peerKeys: options.peerKeys, localKeys: options.localKeys });
  const { laneKey: _dropped, ...row } = entry.row;

  return { ...entry, row: isUnderCheckout(local, options.localKeys) ? { ...row, laneKey: `repo:${local}` } : row };
};

/**
 * A paired machine's rows with each lane moved onto this machine's checkout of the same repository. A shared
 * row whose repository this machine has no checkout of loses its lane rather than keep the peer's path.
 */
export const mapPeerDayRows = (options: {
  rows: PeerDayRows;
  peerKeys: CheckoutKeys;
  localKeys: CheckoutKeys;
}): PeerDayRows => ({
  ...options.rows,
  ...(options.rows.shared ? { shared: options.rows.shared.map((entry) => mapSharedEntry({ ...options, entry })) } : {}),
  rows: options.rows.rows.map((row) => {
    const path = streamKeyRepoPath(row.laneKey);

    return path === undefined
      ? row
      : {
          ...row,
          laneKey: `repo:${translatePeerPath({ path, peerKeys: options.peerKeys, localKeys: options.localKeys })}`,
        };
  }),
});
