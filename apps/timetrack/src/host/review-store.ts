import { DayReviewEdits, DayRows, PinnedRow, PresenceStatement, TimetrackReviewStore } from '@ethlete/timetrack';
import { map } from 'rxjs';
import { invokeHost$ } from './invoke';

type StoredPinnedRow = Omit<PinnedRow, 'from' | 'to' | 'evidence'> & {
  fromMs: number;
  toMs: number;
  evidence: { kind: string; atMs: number; detail: string; summary?: string }[];
};

type StoredStatement = Omit<PresenceStatement, 'from' | 'to'> & { fromMs: number; toMs: number };

type StoredEdits = Omit<DayReviewEdits, 'pinned' | 'statements' | 'frozenRows'> & {
  pinned: StoredPinnedRow[];
  statements: StoredStatement[];
  frozenRows?: unknown;
};

const STORED_DATE_KEY = '$dateMs';

const withStoredDates = (value: unknown): unknown => {
  if (value instanceof Date) return { [STORED_DATE_KEY]: value.getTime() };
  if (Array.isArray(value)) return value.map(withStoredDates);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, withStoredDates(entry)]));
  }

  return value;
};

const withRevivedDates = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(withRevivedDates);
  if (value && typeof value === 'object') {
    const stored = (value as Record<string, unknown>)[STORED_DATE_KEY];

    if (typeof stored === 'number') return new Date(stored);

    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, withRevivedDates(entry)]));
  }

  return value;
};

export const toStoredEdits = (edits: DayReviewEdits): StoredEdits => ({
  overrides: edits.overrides,
  ...(edits.auto ? { auto: edits.auto } : {}),
  ...(edits.autoDescriptions ? { autoDescriptions: edits.autoDescriptions } : {}),
  ...(edits.autoDisputes ? { autoDisputes: edits.autoDisputes } : {}),
  ...(edits.frozenRows ? { frozenRows: withStoredDates(edits.frozenRows) } : {}),
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

export const parseStoredEdits = (stored: StoredEdits): DayReviewEdits => ({
  overrides: stored.overrides ?? {},
  ...(Array.isArray(stored.auto) ? { auto: stored.auto } : {}),
  ...(Array.isArray(stored.autoDescriptions) ? { autoDescriptions: stored.autoDescriptions } : {}),
  ...(Array.isArray(stored.autoDisputes) ? { autoDisputes: stored.autoDisputes } : {}),
  ...(stored.frozenRows && typeof stored.frozenRows === 'object'
    ? { frozenRows: withRevivedDates(stored.frozenRows) as DayRows }
    : {}),
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
      map((stored) => (stored === null ? null : parseStoredEdits(stored))),
    ),
  editsBetween$: (from, to) =>
    invokeHost$<{ day: string; edits: StoredEdits }[]>('day_review_edits_between', { from, to }).pipe(
      map((rows) => rows.map(({ day, edits }) => ({ day, edits: parseStoredEdits(edits) }))),
    ),
  save$: (day, edits) => invokeHost$<void>('set_day_review_edits', { day, edits: toStoredEdits(edits) }),
  clear$: (day) => invokeHost$<void>('set_day_review_edits', { day, edits: null }),
});
