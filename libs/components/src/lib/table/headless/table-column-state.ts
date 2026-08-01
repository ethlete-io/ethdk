/**
 * Reconciling user column state (order, visibility, widths) against a changed `columns` input.
 *
 * The table's column state lives in `linkedSignal`s derived from the `columns` input, so a new
 * array **resets** them - and a consumer's column definitions legitimately change identity all the
 * time (a `computed()` over some other signal, a server-driven list view swapping its column set).
 * Resetting there would silently discard a user's reorder, resize and hidden columns.
 *
 * So each of these keeps whatever the user chose for the columns that still exist, and only takes
 * the declaration's word for columns it has never seen before.
 */

/** The part of a column definition this reconciliation reads - row-type agnostic. */
export type ReconcilableColumn = {
  key: string;
  hidden?: boolean;
};

/**
 * The column order after a `columns` change: the user's order for the columns that survive, with
 * newly declared ones slotted in next to the column they were declared after (so adding a column
 * to the middle of a definition puts it in the middle, not at the end).
 */
export const reconcileColumnOrder = (keys: string[], previous: string[] | undefined) => {
  if (!previous) return keys;

  const declared = new Set(keys);
  const next = previous.filter((key) => declared.has(key));

  // Nothing was added - the filtered previous order is already the answer.
  if (next.length === keys.length) return next;

  keys.forEach((key, index) => {
    if (next.includes(key)) return;

    // The nearest column declared before this one that is already placed; the new column goes
    // right after it (or at the very front, when it was declared before all of them).
    const predecessor = keys
      .slice(0, index)
      .reverse()
      .find((candidate) => next.includes(candidate));

    next.splice(predecessor === undefined ? 0 : next.indexOf(predecessor) + 1, 0, key);
  });

  return next;
};

/**
 * The hidden-column set after a `columns` change: a column the user hid stays hidden and one they
 * revealed stays visible, while a column that wasn't there before takes its declared `hidden`.
 */
export const reconcileHiddenColumns = (
  columns: readonly ReconcilableColumn[],
  previous: { columns: readonly ReconcilableColumn[]; hidden: ReadonlySet<string> } | undefined,
) => {
  const hidden = new Set<string>();

  if (!previous) {
    for (const column of columns) {
      if (column.hidden) hidden.add(column.key);
    }

    return hidden;
  }

  const known = new Set(previous.columns.map((column) => column.key));

  for (const column of columns) {
    const wasHidden = known.has(column.key) ? previous.hidden.has(column.key) : column.hidden;

    if (wasHidden) hidden.add(column.key);
  }

  return hidden;
};

/** The user's width overrides after a `columns` change, dropping the ones whose column is gone. */
export const reconcileColumnWidths = (
  columns: readonly ReconcilableColumn[],
  previous: Record<string, number> | undefined,
) => {
  if (!previous) return {};

  const declared = new Set(columns.map((column) => column.key));
  const widths: Record<string, number> = {};

  for (const [key, width] of Object.entries(previous)) {
    if (declared.has(key)) widths[key] = width;
  }

  return widths;
};
