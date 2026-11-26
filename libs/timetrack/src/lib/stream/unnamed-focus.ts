import { redactTitleUrls } from '../store/title';

/**
 * Why a stretch of focused-window time took no checkout.
 *
 * A private checkout, this app's own window, an application the user declared no work context and a
 * transient dialog that opened over the work are each unnamed on purpose. `no-name` is not a verdict on its own: a window a checkout should have
 * taken lands in it, and so does an application nobody has declared yet. Every cause is reported, so
 * the rows sum to the whole of the folded line rather than to the part of it that is wrong.
 */
export type UnnamedFocusReason =
  'no-name' | 'ambiguous-name' | 'private' | 'own-window' | 'no-work-context' | 'transient';

/**
 * One window title behind a row, and how long that title held the focus.
 *
 * The title is the evidence a row is judged by: an application and a total say a browser lost 42
 * minutes, and only the title says whether they were a development server or a news site.
 */
export type UnnamedFocusTitle = { title: string; ms: number };

/** Focused-window time no checkout took, per application and cause. */
export type UnnamedFocus = {
  /** The application whose window held the focus. Absent before a day's first focus sample. */
  appId?: string;
  reason: UnnamedFocusReason;
  ms: number;
  /**
   * The distinct titles the row is made of, longest first. Empty for a private checkout, whose name
   * a title carries and which a private project link exists to keep out of every report.
   */
  titles: readonly UnnamedFocusTitle[];
};

/**
 * What one day contributed to a span. `StreamDay` satisfies it, and a span needs nothing else from a day.
 */
export type UnnamedFocusDay = {
  focusMs: number;
  unnamedFocus: readonly UnnamedFocus[];
  namedApps: readonly string[];
  /** Absent on a day read before titles were recorded, which then splits no row. */
  namedTitles?: Readonly<Record<string, readonly string[]>>;
};

/**
 * What a row's time is, once the cause and the rest of the span are read together.
 *
 * `unknown` is not a hedge. An application that never named a checkout is either no work context at
 * all or one this app cannot read a name for yet, and to call either of them wrong is to report a
 * number nobody can act on.
 */
export type UnnamedFocusVerdict = 'on-purpose' | 'gap' | 'unknown';

/** A row of a span: what a day reported, and what the whole span makes of it. */
export type UnnamedFocusRow = UnnamedFocus & {
  verdict: UnnamedFocusVerdict;
  /** The one title, after `redactTitleUrls`, a row of a multi-purpose application was split into. */
  title?: string;
};

/** The focus of a span, and the part of it no checkout took, split by what can be said about it. */
export type UnnamedFocusSpan = {
  focusMs: number;
  unnamedMs: number;
  /** Time an application that names checkouts elsewhere lost. It is the part this plan set out to fix. */
  gapMs: number;
  /** Time no cause and no other day can judge. */
  unknownMs: number;
  rows: UnnamedFocusRow[];
};

/** The causes that are the right answer rather than a gap, whatever the rest of the span says. */
const ON_PURPOSE: readonly UnnamedFocusReason[] = ['private', 'own-window', 'no-work-context', 'transient'];

/**
 * What a row's time is.
 *
 * A name two checkouts share is a gap without asking the span: the paths differ, so the window is
 * nameable, and the day drops it only because a title is all it has to go on.
 */
export const verdictFor = (options: { row: UnnamedFocus; namedApps: ReadonlySet<string> }): UnnamedFocusVerdict => {
  const { row, namedApps } = options;

  if (ON_PURPOSE.includes(row.reason)) return 'on-purpose';
  if (row.reason === 'ambiguous-name') return 'gap';

  return row.appId && namedApps.has(row.appId) ? 'gap' : 'unknown';
};

/**
 * A row with its verdict, split per title when it comes from a multi-purpose application that named a
 * checkout: a title that held one on some day is a gap, and every other title is unknown, so one page
 * that named a checkout does not make all of a browser's time a gap.
 */
export const judgeUnnamedFocus = (options: {
  row: UnnamedFocus;
  namedApps: ReadonlySet<string>;
  namedTitles: ReadonlyMap<string, ReadonlySet<string>>;
}): UnnamedFocusRow[] => {
  const { row } = options;
  const verdict = verdictFor(options);
  const named = row.appId ? options.namedTitles.get(row.appId) : undefined;

  if (verdict !== 'gap' || row.reason !== 'no-name' || !named) return [{ ...row, verdict }];

  const byTitle = new Map<string, UnnamedFocusTitle[]>();

  for (const held of row.titles) {
    const title = redactTitleUrls(held.title);

    byTitle.set(title, [...(byTitle.get(title) ?? []), held]);
  }

  const split = [...byTitle].map(([title, titles]): UnnamedFocusRow => ({
    ...row,
    title,
    ms: titles.reduce((sum, held) => sum + held.ms, 0),
    titles: mergeUnnamedTitles([titles]),
    verdict: named.has(title) ? 'gap' : 'unknown',
  }));
  const restMs = row.ms - unnamedFocusMs(split);

  return restMs > 0 ? [...split, { ...row, ms: restMs, titles: [], verdict: 'unknown' }] : split;
};

/** The titles of several rows summed per title, longest first. */
export const mergeUnnamedTitles = (rows: readonly (readonly UnnamedFocusTitle[])[]): UnnamedFocusTitle[] => {
  const summed = new Map<string, number>();

  for (const titles of rows) {
    for (const held of titles) summed.set(held.title, (summed.get(held.title) ?? 0) + held.ms);
  }

  return [...summed]
    .map(([title, ms]) => ({ title, ms }))
    .sort((a, b) => b.ms - a.ms || a.title.localeCompare(b.title));
};

/** How much of a span named no checkout, defect or not. */
export const unnamedFocusMs = (rows: readonly UnnamedFocus[]) => rows.reduce((sum, row) => sum + row.ms, 0);

/**
 * The rows of several days summed per application and cause, longest first.
 *
 * Days are summed rather than concatenated because a stretch belongs to exactly one local day, so no
 * two days can overlap and no merge of windows is needed.
 */
export const mergeUnnamedFocus = (days: readonly (readonly UnnamedFocus[])[]): UnnamedFocus[] => {
  const summed: UnnamedFocus[] = [];

  for (const rows of days) {
    for (const row of rows) {
      const found = summed.find((held) => held.appId === row.appId && held.reason === row.reason);

      if (found) {
        found.ms += row.ms;
        found.titles = mergeUnnamedTitles([found.titles, row.titles]);

        continue;
      }

      summed.push({ ...row, titles: mergeUnnamedTitles([row.titles]) });
    }
  }

  return summed.sort((a, b) => b.ms - a.ms || (a.appId ?? '').localeCompare(b.appId ?? ''));
};

/**
 * Several days as one span: the focus time summed, and the unnamed part of it per application.
 *
 * One day at a time rather than one long range, because the sticky, the presence gate and the safety
 * valve are all scoped to a local day. A range across midnight would let one evening's window name the
 * next morning's checkout.
 */
export const unnamedFocusOver = (days: readonly UnnamedFocusDay[]): UnnamedFocusSpan => {
  const namedApps = new Set(days.flatMap((day) => [...day.namedApps]));
  const namedTitles = new Map<string, Set<string>>();

  for (const day of days) {
    for (const [app, titles] of Object.entries(day.namedTitles ?? {})) {
      namedTitles.set(app, new Set([...(namedTitles.get(app) ?? []), ...titles]));
    }
  }

  const rows = mergeUnnamedFocus(days.map((day) => day.unnamedFocus))
    .flatMap((row) => judgeUnnamedFocus({ row, namedApps, namedTitles }))
    .sort(
      (a, b) =>
        b.ms - a.ms || (a.appId ?? '').localeCompare(b.appId ?? '') || (a.title ?? '').localeCompare(b.title ?? ''),
    );
  const msOf = (verdict: UnnamedFocusVerdict) => unnamedFocusMs(rows.filter((row) => row.verdict === verdict));

  return {
    focusMs: days.reduce((sum, day) => sum + day.focusMs, 0),
    unnamedMs: unnamedFocusMs(rows),
    gapMs: msOf('gap'),
    unknownMs: msOf('unknown'),
    rows,
  };
};
