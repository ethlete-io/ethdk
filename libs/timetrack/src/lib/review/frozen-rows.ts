import { SyncedWorklog } from '../model/proposal';
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
 * still running, Tempo holds none of it, or its rows are frozen already.
 */
export const withFrozenRows = (options: {
  edits: DayReviewEdits;
  rows: DayRows;
  held: boolean;
  finished: boolean;
}): DayReviewEdits | null =>
  options.held && options.finished && !options.edits.frozenRows ? { ...options.edits, frozenRows: options.rows } : null;
