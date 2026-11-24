import { ShotFrame } from '../../host/design';
import { CURRENT, SketchRowOf } from './system-tree';

type FrameSize = { width?: number; height?: number };

/**
 * The size of each shot of `rows` by its `<row> <state>` key: the frame the design server lists for it (`frames`),
 * with every side a live frame reported (`live`) over it. An inherited state takes the product's frame. A row takes
 * listed frames only when the list holds one for each of its shots.
 */
export const shotSizesOf = ({
  rows,
  part,
  frames = [],
  live,
}: {
  rows: readonly SketchRowOf[];
  part: string;
  frames?: readonly ShotFrame[];
  live: Record<string, FrameSize>;
}): Record<string, FrameSize> => {
  const listed: Record<string, FrameSize> = Object.fromEntries(
    rows.flatMap((row) => {
      const found = row.shots.map((shot) => {
        const variant = row.key === CURRENT || shot.inherited ? null : row.key;
        const { state, size } = shot.place;
        const entry = frames.find(
          (entry) =>
            entry.part === part &&
            entry.variant === variant &&
            entry.state === state &&
            (size === undefined || entry.preset === size || entry.width === Number(size)),
        );

        return entry ? ([`${row.key} ${shot.state}`, entry.frame] as const) : null;
      });

      return found.every((entry) => entry !== null) ? found : [];
    }),
  );

  return {
    ...listed,
    ...Object.fromEntries(Object.entries(live).map(([key, size]) => [key, { ...listed[key], ...size }])),
  };
};
