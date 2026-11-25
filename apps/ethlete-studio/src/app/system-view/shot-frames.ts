import { ShotFrame } from '../../host/design';
import { CURRENT, SketchRowOf } from './system-tree';

type FrameSize = { width?: number; height?: number };

/**
 * The size of each shot of `rows` by its `<row> <state>` key: the frame the design server lists for it (`frames`),
 * with every side a live frame reported (`live`) over it. An inherited state takes the product's frame.
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
    rows.flatMap((row) =>
      row.shots.flatMap((shot) => {
        const variant = row.key === CURRENT || shot.inherited ? null : row.key;
        const { state, size } = shot.place;
        const entry = frames.find(
          (entry) =>
            entry.part === part &&
            entry.variant === variant &&
            entry.state === state &&
            (size === undefined || entry.preset === size || entry.width === Number(size)),
        );

        return entry ? [[`${row.key} ${shot.state}`, entry.frame] as const] : [];
      }),
    ),
  );

  return {
    ...listed,
    ...Object.fromEntries(Object.entries(live).map(([key, size]) => [key, { ...listed[key], ...size }])),
  };
};

/**
 * The width of a sketch row: its widest shot once every shot has a width in `sizes`, else `fallback`, so a row the
 * listing misses a shot of does not narrow to its known shots and widen again as the rest report.
 */
export const rowWidthOf = ({
  row,
  sizes,
  fallback,
}: {
  row: SketchRowOf;
  sizes: Record<string, FrameSize>;
  fallback: number | undefined;
}) => {
  const widths = row.shots.map((shot) => sizes[`${row.key} ${shot.state}`]?.width);

  return widths.every((width) => width !== undefined) && widths.length > 0 ? Math.max(...widths) : fallback;
};
