import { SyncedWorklog } from '../model/proposal';
import { TimeWindow, mergeWindows, subtractWindows, windowsMs, windowsOverlap } from '../model/time-window';
import { StreamDay } from '../stream/stream-day';
import { DayRows } from '../rows/build-rows';
import { TempoDayCoverage } from '../tempo/coverage';
import { DayReviewEdits } from './model';

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
  /** Whether Tempo holds work another app or machine wrote on the issue the merged read names for it. */
  booked: boolean;
};

/** A piece shorter than this is the odd minute two machines' clocks disagree by, and draws nothing. */
const PEER_BAND_FLOOR_MS = 5 * 60_000;

/** A difference shorter than one row increment is rounding, and changes nothing a booking holds. */
const CHANGED_FLOOR_MS = 15 * 60_000;

const heldByLane = (rows: DayRows) => {
  const lanes = new Map<string, TimeWindow[]>();

  for (const row of [...rows.proposals, ...rows.unnamed]) {
    if (row.unattended || !row.laneKey) continue;

    lanes.set(row.laneKey, [...(lanes.get(row.laneKey) ?? []), { from: row.from, to: row.to }]);
  }

  return new Map([...lanes].map(([lane, windows]) => [lane, mergeWindows(windows)]));
};

/**
 * Each paired machine's work on a frozen day, from the merged read, where the frozen rows hold none of
 * it in that lane. A band is `booked` when the merged read names an issue for it that `foreignIssues`
 * (Tempo's work on the day that this app did not write) holds.
 */
export const frozenDayPeerBands = (options: {
  frozen: DayRows;
  current: { rows: DayRows; peerLanes: StreamDay['peerLanes'] };
  machineNames: Readonly<Record<string, string>>;
  foreignIssues: readonly string[];
}): PeerBand[] => {
  const held = heldByLane(options.frozen);
  const foreign = new Set(options.foreignIssues);

  return Object.entries(options.current.peerLanes)
    .flatMap(([machineId, lanes]) =>
      Object.entries(lanes).flatMap(([laneKey, windows]) =>
        subtractWindows({ windows: mergeWindows(windows), without: held.get(laneKey) ?? [] })
          .filter((piece) => piece.to.getTime() - piece.from.getTime() >= PEER_BAND_FLOOR_MS)
          .map((piece) => ({
            ...piece,
            machineId,
            machineName: options.machineNames[machineId] ?? machineId,
            laneKey,
            booked: options.current.rows.proposals.some(
              (row) => row.laneKey === laneKey && foreign.has(row.issueKey) && windowsOverlap(row, piece),
            ),
          })),
      ),
    )
    .sort((a, b) => a.from.getTime() - b.from.getTime() || a.laneKey.localeCompare(b.laneKey));
};

/**
 * Whether the day read now covers other time than the rows frozen when it was booked: a lane gained or
 * lost at least one row increment. A renamed band alone is no change.
 */
export const changedAfterBooking = (options: { frozen: DayRows; current: DayRows }) => {
  const frozen = heldByLane(options.frozen);
  const current = heldByLane(options.current);
  const lanes = new Set([...frozen.keys(), ...current.keys()]);
  let differentMs = 0;

  for (const lane of lanes) {
    const before = frozen.get(lane) ?? [];
    const after = current.get(lane) ?? [];

    differentMs +=
      windowsMs(subtractWindows({ windows: after, without: before })) +
      windowsMs(subtractWindows({ windows: before, without: after }));
  }

  return differentMs >= CHANGED_FLOOR_MS;
};
