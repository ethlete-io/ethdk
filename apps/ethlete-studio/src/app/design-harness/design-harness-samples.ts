import { Type } from '@angular/core';
import {
  AGENT_ON_READY_PART_SAMPLE,
  AGENT_SAMPLES,
  buildReadySampleOf,
  BuildReadySample,
  LEGACY_CALL_SAMPLE,
  OPEN_POINTS_SAMPLE,
  PART_EXCEPTIONS_SAMPLE,
  THEME_SWITCHES_SAMPLE,
} from '../design-parts/system-page/system-page-sample';
import { DesignHarnessSketchShotsComponent } from './design-harness-sketch-shots.component';
import {
  SKETCH_CURRENT,
  SKETCH_NARROW_SAMPLE,
  SKETCH_POINTS_SAMPLE,
  SKETCH_ROWS,
  SKETCH_WITHDRAWN,
  SketchRow,
} from '../design-parts/sketches/sketches-sample';

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
  'elements/canvas-frames': ({ zoom, class: extra, ...props }) => ({
    ...props,
    class: `${typeof extra === 'string' ? extra : ''} min-h-120`,
    cameraKey: 'elements/canvas-frames',
    restoredCamera: { x: 0, y: 0, zoom: parseFloat(String(zoom ?? '100%')) / 100 },
  }),
  'pages/sketches': ({ part, same, comparing, withdrawn, points, pointsOpen, ...props }) => {
    const { looks: _looks, ...sample } = part === 'narrow' ? SKETCH_NARROW_SAMPLE : { rows: SKETCH_ROWS, looks: {} };
    const rows = sketchRowsOf(sample.rows, { same: same as string[] | undefined, comparing: comparing === true }).map(
      (row) => (withdrawn && row.key === SKETCH_WITHDRAWN.key ? { ...row, withdrawn: SKETCH_WITHDRAWN.reason } : row),
    );

    return {
      ...props,
      ...sample,
      rows,
      ...(withdrawn ? { withdrawn } : {}),
      ...(points ? { openPoints: SKETCH_POINTS_SAMPLE, pointsClosed: pointsOpen !== true } : {}),
    };
  },
  'pages/system': ({ build, agent, call, ...props }) => {
    const exceptions = PART_EXCEPTIONS_SAMPLE;
    const openCount = OPEN_POINTS_SAMPLE.reduce((sum, group) => sum + group.lines.length, exceptions.length);
    const agentState = agent as keyof typeof AGENT_SAMPLES | undefined;

    return {
      exceptions,
      ...props,
      agent: agentState
        ? props['nothingOpen'] && agentState === 'working'
          ? AGENT_ON_READY_PART_SAMPLE
          : AGENT_SAMPLES[agentState]
        : null,
      call: call ? { ...LEGACY_CALL_SAMPLE, transferred: call === 'transferred' } : null,
      themeSwitches: call ? THEME_SWITCHES_SAMPLE : [],
      buildReady: buildReadySampleOf(
        (build as BuildReadySample | undefined) ?? (props['nothingOpen'] ? 'ready' : 'blocked'),
        openCount,
      ),
    };
  },
};

/** Template inputs a part takes, read from `templates()` of a component the harness creates beside it. */
export const DESIGN_HARNESS_TEMPLATES: Record<string, Type<{ templates: () => Record<string, unknown> }>> = {
  'pages/sketches': DesignHarnessSketchShotsComponent,
};
