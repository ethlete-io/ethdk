import { TempoDayCoverage, TempoIssueCoverage, TimetrackCoverageStore } from '@ethlete/timetrack';
import { map } from 'rxjs';
import { invokeHost$ } from './invoke';

type StoredCoverage = { issues: TempoIssueCoverage[]; observedAtMs: number };

const toStored = (coverage: TempoDayCoverage): StoredCoverage => ({
  issues: coverage.issues,
  observedAtMs: coverage.observedAt.getTime(),
});

const revive = (day: string, stored: StoredCoverage): TempoDayCoverage => ({
  day,
  issues: stored.issues ?? [],
  observedAt: new Date(stored.observedAtMs),
});

/**
 * What Tempo held for a day, in the encrypted store. Dates cross as epoch milliseconds, the same as
 * the review edits do, so neither side has to guess which strings in a stored document were `Date`s.
 */
export const createTauriCoverageStore = (): TimetrackCoverageStore => ({
  forDay$: (day) =>
    invokeHost$<StoredCoverage | null>('tempo_coverage_for_day', { day }).pipe(
      map((stored) => (stored === null ? null : revive(day, stored))),
    ),
  save$: (coverage) => invokeHost$<void>('set_tempo_coverage', { day: coverage.day, coverage: toStored(coverage) }),
});
