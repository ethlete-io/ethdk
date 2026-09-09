/**
 * Why a stretch of focused-window time took no checkout.
 *
 * Only `no-name` is a defect. A private checkout, this app's own window and a name two checkouts share
 * are each unnamed on purpose, and they are reported so that the rows sum to the whole of the folded
 * line rather than to the part that is wrong.
 */
export type UnnamedFocusReason = 'no-name' | 'ambiguous-name' | 'private' | 'own-window';

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
export type UnnamedFocusDay = { focusMs: number; unnamedFocus: readonly UnnamedFocus[] };

/** The focus of a span, and the part of it no checkout took. */
export type UnnamedFocusSpan = {
  focusMs: number;
  unnamedMs: number;
  rows: UnnamedFocus[];
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
  const rows = mergeUnnamedFocus(days.map((day) => day.unnamedFocus));

  return {
    focusMs: days.reduce((sum, day) => sum + day.focusMs, 0),
    unnamedMs: unnamedFocusMs(rows),
    rows,
  };
};
