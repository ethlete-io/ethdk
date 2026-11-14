import { SketchRowOf } from './system-tree';

/**
 * The keys of the shots that may still fold away: a shot whose own compare is pending, and every shot of a state that
 * no row changes while some row's compare of it is pending.
 */
export const undecidedShotsOf = (rows: readonly SketchRowOf[]): ReadonlySet<string> => {
  const shots = rows.flatMap((row) => row.shots.map((shot) => ({ key: `${row.key} ${shot.state}`, ...shot })));
  const changedStates = new Set(shots.filter((shot) => shot.changed === true).map((shot) => shot.state));
  const pendingStates = new Set(shots.filter((shot) => shot.changed === null).map((shot) => shot.state));

  return new Set(
    shots
      .filter((shot) => shot.changed === null || (pendingStates.has(shot.state) && !changedStates.has(shot.state)))
      .map((shot) => shot.key),
  );
};
