import { streamKeyRepoPath } from '../model/block';
import { CheckoutKeys, translatePeerPath } from '../model/peer-path';
import { SyncedWorklog } from '../model/proposal';
import { ReviewedRow } from './model';

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
};

const ACCEPTED_STATES: ReadonlySet<ReviewedRow['state']> = new Set(['accepted', 'edited', 'synced']);

/** The rows of a day this machine sends: the repository rows a person was at, unattended ones left out. */
export const peerDayRowsOf = (options: {
  day: string;
  frozen: boolean;
  rows: readonly ReviewedRow[];
  ledger: readonly SyncedWorklog[];
  standInNames: Readonly<Record<string, string>>;
}): PeerDayRows => {
  const worklogs = new Map(options.ledger.map((entry) => [entry.proposalId, entry.tempoWorklogId]));

  return {
    day: options.day,
    frozen: options.frozen,
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

/** The wire form of {@link PeerDayRows}. */
export const encodePeerDayRows = (rows: PeerDayRows) =>
  JSON.stringify({
    ...rows,
    rows: rows.rows.map((row) => ({ ...row, from: row.from.getTime(), to: row.to.getTime() })),
  });

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
    };
  } catch {
    return null;
  }
};

/** A paired machine's rows with each lane moved onto this machine's checkout of the same repository. */
export const mapPeerDayRows = (options: {
  rows: PeerDayRows;
  peerKeys: CheckoutKeys;
  localKeys: CheckoutKeys;
}): PeerDayRows => ({
  ...options.rows,
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
