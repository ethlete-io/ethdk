/** `sameAsRest` marks a shot that draws the same as its rest state in this row's variant. */
export type SketchFrameShot = { state: string; changed: boolean | null; sameAsRest?: boolean };

export type SketchFrameRow = { key: string; shots: readonly SketchFrameShot[] };

const isBaseRow = (row: SketchFrameRow) => row.key === 'current' || row.key === 'old' || row.key === 'new';

const INTERACTION_SUFFIX = /-(hover|focus-visible|active|disabled)$/;

const interactionGroupOf = (state: string) => state.replace(INTERACTION_SUFFIX, '');

const statesOf = (rows: readonly SketchFrameRow[]) => [
  ...new Set(rows.flatMap((row) => row.shots.map((shot) => shot.state))),
];

/**
 * The states no row changes that also share no interaction group (`reset`, `reset-hover`, ...) with a changed state; a
 * state still compared (`null`) never folds, and none folds when every state would.
 */
export const foldedStatesOf = (rows: readonly SketchFrameRow[]): ReadonlySet<string> => {
  const states = statesOf(rows);
  const touched = new Set(
    rows.flatMap((row) =>
      row.shots.filter((shot) => shot.changed === true).map((shot) => interactionGroupOf(shot.state)),
    ),
  );
  const folded = states.filter(
    (state) =>
      !touched.has(interactionGroupOf(state)) &&
      rows.every((row) =>
        isBaseRow(row)
          ? row.shots.every((shot) => shot.state !== state || shot.changed === false)
          : row.shots.some((shot) => shot.state === state && shot.changed === false),
      ),
  );

  return new Set(folded.length < states.length ? folded : []);
};

/** The states of `current` that every variant lists as unchanged; none without a variant. */
export const keptStatesOf = (current: readonly string[], variants: readonly (readonly string[])[]): string[] =>
  variants.length === 0 ? [] : current.filter((state) => variants.every((unchanged) => unchanged.includes(state)));

/** The states no variant is known to change yet: those still compared (`null`) and those known unchanged. */
export const unknownStatesOf = (rows: readonly SketchFrameRow[]): ReadonlySet<string> =>
  new Set(
    statesOf(rows).filter(
      (state) =>
        !rows.some((row) => !isBaseRow(row) && row.shots.some((shot) => shot.state === state && shot.changed === true)),
    ),
  );

/**
 * The rows a sketch view draws, each with the shots left after the fold. `listed` are the visible rows, `hidden` the
 * withdrawn ones that still count toward the fold, `open` shows every state. A row also drops each shot it draws the
 * same as its rest state (`sameAsRest`). The Studio sketch view and
 * `et design shot --states --variants` both draw exactly this set.
 */
export const shownSketchRowsOf = <T extends SketchFrameRow>(options: {
  listed: readonly T[];
  hidden?: readonly T[];
  open?: boolean;
}): T[] => {
  const { listed, hidden = [], open = false } = options;
  const pending = listed.some((row) => !isBaseRow(row) && row.shots.some((shot) => shot.changed === null));
  const all = [...listed, ...hidden];
  const folded = open ? new Set<string>() : pending ? unknownStatesOf(all) : foldedStatesOf(all);

  if (folded.size === 0 && !listed.some((row) => row.shots.some((shot) => shot.sameAsRest))) return [...listed];

  return listed.map((row) => ({
    ...row,
    shots: row.shots.filter((shot) => !folded.has(shot.state) && (open || !shot.sameAsRest)),
  }));
};

/** The `[row key, state]` frames of `shownSketchRowsOf`, in row then state order. */
export const sketchFrameSetOf = (options: Parameters<typeof shownSketchRowsOf>[0]): [string, string][] =>
  shownSketchRowsOf(options).flatMap((row) => row.shots.map((shot): [string, string] => [row.key, shot.state]));
