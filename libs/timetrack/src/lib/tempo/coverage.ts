import { ForeignWorklog } from './subtract';

/** How much of one day Tempo already holds for one issue, written by somebody other than this app. */
export type TempoIssueCoverage = {
  issueKey: string;
  coveredMs: number;
};

/**
 * What Tempo held for one local calendar day, as the Sync preview last read it.
 *
 * The ledger records only what this app wrote, so time the user logged in Tempo by hand is invisible
 * to it — and a day logged by hand reads as a day nobody logged at all. This is the record that closes
 * that gap for every surface with no token: the week view and the end-of-day reminder read it instead
 * of asking Tempo.
 *
 * It states a moment and goes stale. Time deleted in Tempo after the last preview still reads as
 * covered until the next preview runs.
 */
export type TempoDayCoverage = {
  day: string;
  /** Totalled per issue, which is the unit the subtraction matches on. */
  issues: TempoIssueCoverage[];
  observedAt: Date;
};

/** Totals one day's foreign worklogs per issue, which is the whole of what the record holds. */
export const tempoDayCoverageOf = (options: {
  day: string;
  foreign: readonly ForeignWorklog[];
  observedAt?: Date;
}): TempoDayCoverage => {
  const coveredByIssueKey = new Map<string, number>();

  for (const worklog of options.foreign) {
    coveredByIssueKey.set(worklog.issueKey, (coveredByIssueKey.get(worklog.issueKey) ?? 0) + worklog.durationMs);
  }

  return {
    day: options.day,
    issues: [...coveredByIssueKey].map(([issueKey, coveredMs]) => ({ issueKey, coveredMs })),
    observedAt: options.observedAt ?? new Date(),
  };
};

/**
 * The record as `subtractForeignTime` reads it, so a day reduced offline comes out the same as a day a
 * sync plans against the live Tempo answer.
 */
export const coverageAsForeignTime = (coverage: TempoDayCoverage | null | undefined): ForeignWorklog[] =>
  (coverage?.issues ?? []).map((issue) => ({ issueKey: issue.issueKey, durationMs: issue.coveredMs }));
