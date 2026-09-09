/** A half-open span of wall-clock time. */
export type TimeWindow = { from: Date; to: Date };

/** The union of the windows, in order. Overlapping and touching windows become one. */
export const mergeWindows = (windows: readonly TimeWindow[]): TimeWindow[] => {
  const sorted = [...windows].filter((window) => window.to > window.from).sort((a, b) => +a.from - +b.from);
  const merged: TimeWindow[] = [];

  for (const window of sorted) {
    const last = merged[merged.length - 1];

    if (last && window.from.getTime() <= last.to.getTime()) {
      if (window.to > last.to) last.to = window.to;
      continue;
    }

    merged.push({ from: window.from, to: window.to });
  }

  return merged;
};

/** The parts of `windows` that fall inside `within`. */
export const clipWindows = (options: { windows: readonly TimeWindow[]; within: readonly TimeWindow[] }): TimeWindow[] =>
  options.windows.flatMap((window) =>
    options.within.flatMap((bound) => {
      const from = Math.max(window.from.getTime(), bound.from.getTime());
      const to = Math.min(window.to.getTime(), bound.to.getTime());

      return to > from ? [{ from: new Date(from), to: new Date(to) }] : [];
    }),
  );

/** How long the windows are in total. Overlapping windows are counted twice — merge them first. */
export const windowsMs = (windows: readonly TimeWindow[]) =>
  windows.reduce((sum, window) => sum + Math.max(0, window.to.getTime() - window.from.getTime()), 0);

/** Whether an instant falls in one of the windows, either edge included. */
export const windowsContain = (windows: readonly TimeWindow[], at: Date) =>
  windows.some((window) => at >= window.from && at <= window.to);

/**
 * The parts of `windows` that fall outside `without`. The result is merged, so it never overlaps.
 *
 * It is the counterpart of `clipWindows`: together the two split a set of windows by a boundary and
 * lose nothing, which is what keeps attended and unattended time from double-counting a minute.
 */
export const subtractWindows = (options: {
  windows: readonly TimeWindow[];
  without: readonly TimeWindow[];
}): TimeWindow[] => {
  let rest = mergeWindows(options.windows);

  for (const cut of options.without) {
    rest = rest.flatMap((window) => {
      if (cut.to <= window.from || cut.from >= window.to) return [window];

      const parts: TimeWindow[] = [];

      if (cut.from > window.from) parts.push({ from: window.from, to: cut.from });
      if (cut.to < window.to) parts.push({ from: cut.to, to: window.to });

      return parts;
    });
  }

  return rest;
};
