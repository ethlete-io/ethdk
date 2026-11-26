import { Observable, combineLatest, map } from 'rxjs';
import { SyncedWorklog } from '../model/proposal';
import { DayBoundary, localDayRange, shiftDayKey } from '../review/day';
import { TimetrackLedgerStore } from './ports';

const instantOfProposalId = (proposalId: string) => {
  const at = new Date(proposalId.slice(proposalId.lastIndexOf('@') + 1));

  return proposalId.includes('@') && !Number.isNaN(at.getTime()) ? at : null;
};

/**
 * Everything the ledger holds for the instants of one review day, whichever day key it was stored under.
 *
 * An entry is keyed by the boundary in force when it was written, so after the boundary changes a
 * late-night entry sits under the neighbouring key. A proposal id names its start instant, and that
 * instant is what places the entry; an id that names none falls back to its stored day.
 */
export const ledgerEntriesForRange$ = (options: {
  ledger: TimetrackLedgerStore;
  day: string;
  boundary: DayBoundary;
}): Observable<SyncedWorklog[]> => {
  const { ledger, day, boundary } = options;
  const { from, to } = localDayRange(day, boundary);

  return combineLatest([-1, 0, 1].map((offset) => ledger.entriesForDay$(shiftDayKey(day, offset)))).pipe(
    map((batches) => {
      const unique = new Map(batches.flat().map((entry) => [entry.proposalId, entry]));

      return [...unique.values()].filter((entry) => {
        const at = instantOfProposalId(entry.proposalId);

        return at ? at >= from && at < to : entry.day === day;
      });
    }),
  );
};
