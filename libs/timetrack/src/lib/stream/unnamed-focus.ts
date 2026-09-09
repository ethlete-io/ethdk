/**
 * Why a stretch of focused-window time took no checkout.
 *
 * A private checkout, this app's own window and an application the user declared no work context are
 * each unnamed on purpose. `no-name` is not a verdict on its own: a window a checkout should have
 * taken lands in it, and so does an application nobody has declared yet. Every cause is reported, so
 * the rows sum to the whole of the folded line rather than to the part of it that is wrong.
 */
export type UnnamedFocusReason = 'no-name' | 'ambiguous-name' | 'private' | 'own-window' | 'no-work-context';

/** Focused-window time no checkout took, per application and cause. */
export type UnnamedFocus = {
  /** The application whose window held the focus. Absent before a day's first focus sample. */
  appId?: string;
  reason: UnnamedFocusReason;
  ms: number;
};

/**
 * What one day contributed to a span. `StreamDay` satisfies it, and a span needs nothing else from a day.
 */
export type UnnamedFocusDay = {
  focusMs: number;
  unnamedFocus: readonly UnnamedFocus[];
  namedApps: readonly string[];
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
export type UnnamedFocusRow = UnnamedFocus & { verdict: UnnamedFocusVerdict };

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
const ON_PURPOSE: readonly UnnamedFocusReason[] = ['private', 'own-window', 'no-work-context'];

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

        continue;
      }

      summed.push({ ...row });
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
  const rows = mergeUnnamedFocus(days.map((day) => day.unnamedFocus)).map((row) => ({
    ...row,
    verdict: verdictFor({ row, namedApps }),
  }));
  const msOf = (verdict: UnnamedFocusVerdict) => unnamedFocusMs(rows.filter((row) => row.verdict === verdict));

  return {
    focusMs: days.reduce((sum, day) => sum + day.focusMs, 0),
    unnamedMs: unnamedFocusMs(rows),
    gapMs: msOf('gap'),
    unknownMs: msOf('unknown'),
    rows,
  };
};
