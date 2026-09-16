import { DayReviewEdits, PinnedRow, PresenceStatement, TimetrackReviewStore } from '@ethlete/timetrack';
import { map } from 'rxjs';
import { invokeHost$ } from './invoke';

type StoredPinnedRow = Omit<PinnedRow, 'from' | 'to' | 'evidence'> & {
  fromMs: number;
  toMs: number;
  evidence: { kind: string; atMs: number; detail: string; summary?: string }[];
};

type StoredStatement = Omit<PresenceStatement, 'from' | 'to'> & { fromMs: number; toMs: number };

type StoredEdits = Omit<DayReviewEdits, 'pinned' | 'statements'> & {
  pinned: StoredPinnedRow[];
  statements: StoredStatement[];
};

const toStored = (edits: DayReviewEdits): StoredEdits => ({
  overrides: edits.overrides,
  pinned: edits.pinned.map(({ from, to, evidence, ...rest }) => ({
    ...rest,
    fromMs: from.getTime(),
    toMs: to.getTime(),
    evidence: evidence.map(({ at, ...entry }) => ({ ...entry, atMs: at.getTime() })),
  })),
  statements: edits.statements.map(({ from, to, ...rest }) => ({
    ...rest,
    fromMs: from.getTime(),
    toMs: to.getTime(),
  })),
});

const revive = (stored: StoredEdits): DayReviewEdits => ({
  overrides: stored.overrides ?? {},
  pinned: (stored.pinned ?? []).map(({ fromMs, toMs, evidence, ...rest }) => ({
    ...rest,
    from: new Date(fromMs),
    to: new Date(toMs),
    evidence: evidence.map(({ atMs, ...entry }) => ({ ...entry, at: new Date(atMs) })),
  })) as PinnedRow[],
  statements: (stored.statements ?? []).map(({ fromMs, toMs, ...rest }) => ({
    ...rest,
    from: new Date(fromMs),
    to: new Date(toMs),
  })),
});

/**
 * A day's review edits in the encrypted store. Dates cross as epoch milliseconds rather than as the
 * ISO strings `JSON.stringify` would produce, so nothing on either side has to guess which strings in
 * a stored document used to be `Date`s.
 */
export const createTauriReviewStore = (): TimetrackReviewStore => ({
  editsFor$: (day) =>
    invokeHost$<StoredEdits | null>('day_review_edits', { day }).pipe(
      map((stored) => (stored === null ? null : revive(stored))),
    ),
  save$: (day, edits) => invokeHost$<void>('set_day_review_edits', { day, edits: toStored(edits) }),
  clear$: (day) => invokeHost$<void>('set_day_review_edits', { day, edits: null }),
});
