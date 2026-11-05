import {
  buildReadySampleOf,
  BuildReadySample,
  OPEN_POINTS_SAMPLE,
  PART_EXCEPTIONS_SAMPLE,
} from '../design-parts/system-page/system-page-sample';
import { SKETCH_CURRENT, SKETCH_NARROW_SAMPLE, SKETCH_ROWS, SketchRow } from '../design-parts/sketches/sketches-sample';

type Props = Record<string, unknown>;

const sketchRowsOf = (rows: SketchRow[], { same = [], comparing = false }: { same?: string[]; comparing?: boolean }) =>
  rows.map((row) =>
    row.key === SKETCH_CURRENT || (!comparing && !same.includes(row.key))
      ? row
      : {
          ...row,
          shots: row.shots.map((shot) =>
            comparing
              ? { ...shot, changed: null }
              : {
                  ...shot,
                  changed: false,
                  height: rows[0]?.shots.find((first) => first.state === shot.state)?.height ?? shot.height,
                },
          ),
        },
  );

/** Replaces a design-only prop that picks sample data with the inputs that data needs. */
export const DESIGN_HARNESS_SAMPLES: Record<string, (props: Props) => Props> = {
  'pages/sketches': ({ part, same, comparing, ...props }) => {
    const sample = part === 'narrow' ? SKETCH_NARROW_SAMPLE : { rows: SKETCH_ROWS };
    const rows = sketchRowsOf(sample.rows, { same: same as string[] | undefined, comparing: comparing === true });

    return { ...props, ...sample, rows };
  },
  'pages/system': ({ build, ...props }) => {
    const exceptionCount = PART_EXCEPTIONS_SAMPLE.length;
    const openCount = OPEN_POINTS_SAMPLE.reduce((sum, group) => sum + group.lines.length, exceptionCount);

    return {
      exceptionCount,
      ...props,
      buildReady: buildReadySampleOf(
        (build as BuildReadySample | undefined) ?? (props['nothingOpen'] ? 'ready' : 'blocked'),
        openCount,
      ),
    };
  },
};
