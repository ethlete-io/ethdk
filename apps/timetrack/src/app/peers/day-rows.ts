import {
  DayReviewEdits,
  PeerDayRows,
  ReviewedRow,
  StandIn,
  SyncedWorklog,
  mapPeerDayRows,
  peerDayRowsOf,
  withPeerSharedEntries,
} from '@ethlete/timetrack';
import { HostReceivedRange } from '../../host';

/** This machine's rows of a day as its paired machines receive them. */
export const ownDayRowsOf = (options: {
  day: string;
  frozen: boolean;
  rows: readonly ReviewedRow[];
  ledger: readonly SyncedWorklog[];
  standIns: readonly StandIn[];
  edits?: DayReviewEdits;
}): PeerDayRows =>
  peerDayRowsOf({
    ...options,
    standInNames: Object.fromEntries(options.standIns.map((standIn) => [standIn.id, standIn.name])),
  });

/** The rows each paired machine last sent for `day`, by machine id, in this machine's lanes. */
export const receivedDayRowsOn = (options: {
  received: HostReceivedRange;
  day: string;
}): Readonly<Record<string, PeerDayRows>> =>
  Object.fromEntries(
    options.received.dayRows
      .filter((sent) => sent.rows.day === options.day)
      .map((sent) => [
        sent.machineId,
        mapPeerDayRows({
          rows: sent.rows,
          peerKeys: options.received.repoKeys[sent.machineId] ?? {},
          localKeys: options.received.ownRepoKeys,
        }),
      ]),
  );

export const withReceivedSharedRows = (options: {
  edits: DayReviewEdits;
  received: HostReceivedRange;
  day: string;
}): DayReviewEdits => {
  const offsets = new Map(options.received.dayRows.map((sent) => [sent.machineId, sent.clockOffsetMs ?? 0]));

  return withPeerSharedEntries({
    edits: options.edits,
    peers: Object.entries(receivedDayRowsOn(options)).map(([machineId, rows]) => ({
      entries: rows.shared ?? [],
      clockOffsetMs: offsets.get(machineId) ?? 0,
    })),
  });
};
