import { streamKeyRepoPath } from '../model/block';
import { SyncedWorklog } from '../model/proposal';
import {
  TimeWindow,
  clipWindows,
  mergeWindows,
  subtractWindows,
  windowsMs,
  windowsOverlap,
} from '../model/time-window';
import { DayRows } from '../rows/build-rows';
import { StreamDay } from '../stream/stream-day';
import { TempoDayCoverage } from '../tempo/coverage';
import { TempoSyncPlan } from '../tempo/diff';
import { TempoSyncOutcome } from '../tempo/execute';
import { separateOverlappingProposals } from '../tempo/separate';
import { TempoWorklog } from '../tempo/worklogs';
import { DayReview, DayReviewEdits, ReviewedRow, WrittenWorklog, isNamedRow } from './model';
import { PeerDayRows } from './peer-rows';

/** Whether Tempo holds work on a day: a worklog this app wrote, or one the stored coverage read. */
export const isDayHeldByTempo = (options: {
  ledger: readonly SyncedWorklog[];
  coverage: Pick<TempoDayCoverage, 'issues'> | null;
}) => options.ledger.length > 0 || !!options.coverage?.issues.length;

/**
 * The edits with the day's rows frozen into them, or `null` when nothing is to be frozen: the day is
 * still running, this app booked none of it, or its rows are frozen already. A day only another
 * machine booked stays open, so a later merge still reaches its rows.
 */
export const withFrozenRows = (options: {
  edits: DayReviewEdits;
  rows: DayRows;
  /** What this app wrote to Tempo on the day. */
  ledger: readonly SyncedWorklog[];
  finished: boolean;
}): DayReviewEdits | null =>
  options.ledger.length > 0 && options.finished && !options.edits.frozenRows
    ? { ...options.edits, frozenRows: options.rows }
    : null;

/** A paired machine's work on a frozen day that the frozen rows do not hold. Drawn, never booked here. */
export type PeerBand = TimeWindow & {
  machineId: string;
  machineName: string;
  laneKey: string;
  /** Booked to Tempo on its machine, or, for a band read from raw events, held by Tempo's foreign work. */
  booked: boolean;
  /** The issue or stand-in name the paired machine gave the row. Absent on a band read from raw events. */
  name?: string;
};

/** A piece shorter than this is the odd minute two machines' clocks disagree by, and draws nothing. */
const PEER_BAND_FLOOR_MS = 5 * 60_000;

/** A row increment. A difference shorter than one is rounding, and changes nothing a booking holds. */
const ROW_INCREMENT_MS = 15 * 60_000;

const heldByLane = (rows: DayRows) => {
  const lanes = new Map<string, TimeWindow[]>();

  for (const row of [...rows.proposals, ...rows.unnamed]) {
    if (row.unattended || !row.laneKey) continue;

    lanes.set(row.laneKey, [...(lanes.get(row.laneKey) ?? []), { from: row.from, to: row.to }]);
  }

  return new Map([...lanes].map(([lane, windows]) => [lane, mergeWindows(windows)]));
};

const rawPeerBands = (options: {
  machineId: string;
  machineName: string;
  lanes: Readonly<Record<string, readonly TimeWindow[]>>;
  held: ReadonlyMap<string, TimeWindow[]>;
  current: DayRows;
  foreign: ReadonlySet<string>;
}): PeerBand[] =>
  Object.entries(options.lanes)
    .filter(([laneKey]) => streamKeyRepoPath(laneKey) !== undefined)
    .flatMap(([laneKey, windows]) =>
      subtractWindows({ windows: mergeWindows(windows), without: options.held.get(laneKey) ?? [] })
        .filter((piece) => piece.to.getTime() - piece.from.getTime() >= PEER_BAND_FLOOR_MS)
        .map((piece) => ({
          ...piece,
          machineId: options.machineId,
          machineName: options.machineName,
          laneKey,
          booked: options.current.proposals.some(
            (row) => row.laneKey === laneKey && options.foreign.has(row.issueKey) && windowsOverlap(row, piece),
          ),
        })),
    );

/**
 * Each paired machine's work on a frozen day, in repository lanes only. A machine that sent its rows
 * of the day (`peerRows`, by machine id, lanes already mapped onto this machine's checkouts) is drawn
 * row by row as it sent them. For any other, its raw blocks from the merged read are drawn where the
 * frozen rows hold none of them, `booked` when the merged read names an issue for them that
 * `foreignIssues` (Tempo's work on the day that this app did not write) holds.
 */
export const frozenDayPeerBands = (options: {
  frozen: DayRows;
  current: { rows: DayRows; peerLanes: StreamDay['peerLanes'] };
  peerRows?: Readonly<Record<string, PeerDayRows>>;
  machineNames: Readonly<Record<string, string>>;
  foreignIssues: readonly string[];
}): PeerBand[] => {
  const held = heldByLane(options.frozen);
  const foreign = new Set(options.foreignIssues);
  const peerRows = options.peerRows ?? {};
  const machines = new Set([...Object.keys(options.current.peerLanes), ...Object.keys(peerRows)]);

  return [...machines]
    .flatMap((machineId): PeerBand[] => {
      const machineName = options.machineNames[machineId] ?? machineId;
      const sent = peerRows[machineId];

      if (!sent) {
        return rawPeerBands({
          machineId,
          machineName,
          lanes: options.current.peerLanes[machineId] ?? {},
          held,
          current: options.current.rows,
          foreign,
        });
      }

      return sent.rows
        .filter((row) => streamKeyRepoPath(row.laneKey) !== undefined)
        .map((row) => {
          const name = row.issueKey ?? row.standInName;

          return {
            from: row.from,
            to: row.to,
            machineId,
            machineName,
            laneKey: row.laneKey,
            booked: row.state === 'booked',
            ...(name ? { name } : {}),
          };
        });
    })
    .sort((a, b) => a.from.getTime() - b.from.getTime() || a.laneKey.localeCompare(b.laneKey));
};

const ontoIncrements = (window: TimeWindow): TimeWindow => ({
  from: new Date(Math.floor(window.from.getTime() / ROW_INCREMENT_MS) * ROW_INCREMENT_MS),
  to: new Date(Math.ceil(window.to.getTime() / ROW_INCREMENT_MS) * ROW_INCREMENT_MS),
});

/**
 * The time in each lane a paired machine accounts for: its raw blocks and the rows it sent, widened to
 * whole increments, plus each current row there that this time covers at least half of, since the
 * row's cut filled the gaps between the machine's blocks.
 */
const peerTimeByLane = (options: {
  current: DayRows;
  peerLanes: StreamDay['peerLanes'];
  peerRows: Readonly<Record<string, PeerDayRows>>;
}) => {
  const lanes = new Map<string, TimeWindow[]>();
  const add = (laneKey: string, window: TimeWindow) =>
    lanes.set(laneKey, [...(lanes.get(laneKey) ?? []), ontoIncrements(window)]);

  for (const machine of Object.values(options.peerLanes)) {
    for (const [laneKey, windows] of Object.entries(machine)) for (const window of windows) add(laneKey, window);
  }

  for (const sent of Object.values(options.peerRows)) for (const row of sent.rows) add(row.laneKey, row);

  const covered = new Map([...lanes].map(([lane, windows]) => [lane, mergeWindows(windows)]));

  for (const row of [...options.current.proposals, ...options.current.unnamed]) {
    const peer = row.laneKey ? covered.get(row.laneKey) : undefined;

    if (!row.laneKey || !peer) continue;

    const spanMs = row.to.getTime() - row.from.getTime();

    if (spanMs > 0 && windowsMs(clipWindows({ windows: peer, within: [row] })) * 2 >= spanMs) {
      add(row.laneKey, row);
    }
  }

  return new Map([...lanes].map(([lane, windows]) => [lane, mergeWindows(windows)]));
};

/**
 * Whether this machine's own read of the day now covers other time than the rows frozen when it was
 * booked: a lane gained or lost at least one row increment. A renamed band alone is no change, and
 * neither is time a paired machine accounts for (`peerLanes`, `peerRows`), which its bands show.
 */
export const changedAfterBooking = (options: {
  frozen: DayRows;
  current: DayRows;
  peerLanes?: StreamDay['peerLanes'];
  peerRows?: Readonly<Record<string, PeerDayRows>>;
}) => {
  const frozen = heldByLane(options.frozen);
  const current = heldByLane(options.current);
  const peer = peerTimeByLane({
    current: options.current,
    peerLanes: options.peerLanes ?? {},
    peerRows: options.peerRows ?? {},
  });
  const lanes = new Set([...frozen.keys(), ...current.keys()]);
  let differentMs = 0;

  for (const lane of lanes) {
    const without = peer.get(lane) ?? [];
    const before = subtractWindows({ windows: frozen.get(lane) ?? [], without });
    const after = subtractWindows({ windows: current.get(lane) ?? [], without });

    differentMs +=
      windowsMs(subtractWindows({ windows: after, without: before })) +
      windowsMs(subtractWindows({ windows: before, without: after }));
  }

  return differentMs >= ROW_INCREMENT_MS;
};

/** The edits a reviewer and auto mode made, without the rows and the review a booking stored. */
export const openEditsOf = (edits: DayReviewEdits): DayReviewEdits => {
  const { frozenRows: _frozenRows, booked: _booked, ...open } = edits;

  return open;
};

const sortedKeys = (_key: string, value: unknown) =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
    : value;

/** Two values as one JSON text, keys in order, so a value read back from the store compares equal. */
export const sameStored = (left: unknown, right: unknown) =>
  JSON.stringify(left, sortedKeys) === JSON.stringify(right, sortedKeys);

/** The worklogs Tempo holds that the ledger says this app wrote, with the issue key each is on. */
export const writtenWorklogsOf = (options: {
  ledger: readonly SyncedWorklog[];
  remote: readonly TempoWorklog[];
  keysByIssueId: ReadonlyMap<string, string>;
}): WrittenWorklog[] => {
  const remoteById = new Map(options.remote.map((worklog) => [worklog.id, worklog]));

  return options.ledger.flatMap((entry) => {
    const worklog = remoteById.get(entry.tempoWorklogId);
    const issueKey = worklog ? options.keysByIssueId.get(worklog.issueId) : undefined;

    if (!worklog || !issueKey) return [];

    return [
      {
        proposalId: entry.proposalId,
        worklogId: worklog.id,
        issueKey,
        from: worklog.from,
        durationMs: worklog.durationMs,
        description: worklog.description,
      },
    ];
  });
};

/**
 * `written` with a sync's own writes laid over it. Tempo is eventually consistent, so a read straight
 * after the writes can miss what they just created or changed.
 */
export const writtenAfterSync = (options: {
  written: readonly WrittenWorklog[];
  plan: TempoSyncPlan;
  outcome: TempoSyncOutcome;
}): WrittenWorklog[] => {
  const landed = new Map(
    options.outcome.rows
      .filter((row) => row.status === 'written' && row.tempoWorklogId)
      .map((row) => [`${row.kind}:${row.proposalId}`, row.tempoWorklogId ?? '']),
  );
  const deleted = new Set(
    options.plan.deletes.flatMap((write) => (landed.has(`delete:${write.proposalId}`) ? [write.tempoWorklogId] : [])),
  );
  const writes = [
    ...options.plan.creates.map((write) => ({ kind: 'create', write })),
    ...options.plan.updates.map((write) => ({ kind: 'update', write })),
  ].flatMap(({ kind, write }): WrittenWorklog[] => {
    const worklogId = landed.get(`${kind}:${write.proposal.id}`);

    if (!worklogId) return [];

    return [
      {
        proposalId: write.proposal.id,
        worklogId,
        issueKey: write.proposal.issueKey,
        from: write.proposal.from,
        durationMs: write.proposal.durationMs,
        description: write.proposal.description,
      },
    ];
  });
  const rewritten = new Set(writes.map((written) => written.worklogId));

  return [
    ...options.written.filter((written) => !deleted.has(written.worklogId) && !rewritten.has(written.worklogId)),
    ...writes,
  ];
};

const allRowsOf = (review: DayReview) => [...review.rows, ...review.hidden];

const byStart = (a: ReviewedRow, b: ReviewedRow) =>
  a.from.getTime() - b.from.getTime() || (a.issueKey ?? '').localeCompare(b.issueKey ?? '');

const editedFieldsOver = (options: { stored: ReviewedRow; before: ReviewedRow; after: ReviewedRow }) => {
  const row: Record<string, unknown> = { ...options.stored };
  const before: Record<string, unknown> = options.before;
  const after: Record<string, unknown> = options.after;

  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (sameStored(before[key], after[key])) continue;
    if (after[key] === undefined) delete row[key];
    else row[key] = after[key];
  }

  return row as ReviewedRow;
};

/**
 * A booked day's stored review with an edit made since laid over it. `before` and `after` are the day
 * drawn by today's rules with the edits the review was stored with and with the current ones: a row
 * keeps its stored form but for the fields they draw differently, so only what the edit changed is drawn
 * by today's rules. A row whose worklogs changed is drawn as `after` draws it.
 * The totals and warnings are `after`'s.
 */
export const patchBookedReview = (options: { stored: DayReview; before: DayReview; after: DayReview }): DayReview => {
  const stored = new Map(allRowsOf(options.stored).map((row) => [row.id, row]));
  const before = new Map(allRowsOf(options.before).map((row) => [row.id, row]));
  const after = new Map(allRowsOf(options.after).map((row) => [row.id, row]));
  const ids = [...new Set([...stored.keys(), ...after.keys()])];
  const rows = ids.flatMap((id): ReviewedRow[] => {
    const now = after.get(id);
    const then = before.get(id);
    const was = stored.get(id);

    if (!now) return was && !then ? [was] : [];
    if (!was || !then || !sameStored(was.worklogIds, now.worklogIds)) return [now];

    return [editedFieldsOver({ stored: was, before: then, after: now })];
  });

  return {
    ...options.after,
    rows: rows.filter((row) => !row.hidden).sort(byStart),
    hidden: rows.filter((row) => row.hidden),
    behind: options.stored.behind,
  };
};

/**
 * A booked day's review with a read-only row for each worklog this app wrote that no row carries, drawn
 * from the worklog as Tempo holds it and counted in the day's totals. The row keeps the ledger's id, so
 * a sync reads the worklog as its own rather than as one to delete. See ADR 0038.
 */
export const withUncarriedWorklogs = (options: {
  review: DayReview;
  written: readonly WrittenWorklog[];
  backgroundProjects?: readonly string[];
  incrementMs?: number;
}): DayReview => {
  const { review, written } = options;
  const carried = new Set(allRowsOf(review).flatMap((row) => row.worklogIds ?? []));
  const rows = written
    .filter((worklog) => !carried.has(worklog.worklogId))
    .map((worklog): ReviewedRow => ({
      id: worklog.proposalId,
      issueKey: worklog.issueKey,
      from: worklog.from,
      to: new Date(worklog.from.getTime() + worklog.durationMs),
      durationMs: worklog.durationMs,
      observedMs: 0,
      description: worklog.description,
      confidence: 'certain',
      evidence: [],
      state: 'synced',
      edited: false,
      hidden: false,
      worklogIds: [worklog.worklogId],
    }));

  if (!rows.length) return review;

  const writtenMs = (drawn: ReviewedRow[]) =>
    separateOverlappingProposals({
      proposals: drawn.filter(isNamedRow),
      backgroundProjects: options.backgroundProjects,
      incrementMs: options.incrementMs,
    }).reduce((sum, write) => sum + write.durationMs, 0);
  const addedMs = writtenMs([...review.rows, ...rows]) - writtenMs(review.rows);
  const { check } = review;

  return {
    ...review,
    rows: [...review.rows, ...rows].sort(byStart),
    check: {
      ...check,
      proposedMs: check.proposedMs + addedMs,
      loggedMs: check.loggedMs + addedMs,
      ...(check.deltaMs === undefined ? {} : { deltaMs: check.deltaMs + addedMs }),
    },
  };
};

/**
 * The edits with the day drawn into them as it is booked: `written` is what Tempo holds of this app's
 * writes. `review` draws a day's edits, as `reviewDay` does. A day booked again keeps every row the
 * edits since and the new writes leave alone. See ADR 0040.
 */
export const withBookedReview = (options: {
  edits: DayReviewEdits;
  written: WrittenWorklog[];
  review: (edits: DayReviewEdits) => DayReview;
}): DayReviewEdits => {
  const { frozenRows, booked } = options.edits;
  const open = openEditsOf(options.edits);
  const drawn = (edits: DayReviewEdits) =>
    options.review({ ...edits, ...(frozenRows ? { frozenRows } : {}), booked: { written: options.written, edits } });
  const review = booked?.review
    ? patchBookedReview({ stored: booked.review, before: drawn(booked.edits), after: drawn(open) })
    : drawn(open);

  return { ...open, ...(frozenRows ? { frozenRows } : {}), booked: { written: options.written, edits: open, review } };
};
