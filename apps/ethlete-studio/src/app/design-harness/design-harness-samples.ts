import { Type } from '@angular/core';
import {
  AGENT_ON_READY_PART_SAMPLE,
  AGENT_SAMPLES,
  buildReadySampleOf,
  BuildReadySample,
  LEGACY_CALL_SAMPLE,
  LISTING_ERROR_SAMPLE,
  OPEN_POINTS_SAMPLE,
  PART_EXCEPTIONS_SAMPLE,
  THEME_SWITCHES_SAMPLE,
} from '../design-parts/system-page/system-page-sample';
import { DesignHarnessSketchShotsComponent } from './design-harness-sketch-shots.component';
import {
  SKETCH_ADDED_STATE,
  SKETCH_AGENT_RUNS,
  SKETCH_CURRENT,
  SKETCH_EDIT_SAMPLE,
  SKETCH_MERGE_PORTS,
  SKETCH_COMMENT_DRAFT_SAMPLE,
  SKETCH_COMMENT_DRAFT_TEXT,
  SKETCH_COMMENTS_SAMPLE,
  SKETCH_NARROW_SAMPLE,
  SKETCH_POINTS_SAMPLE,
  SKETCH_ROWS,
  SKETCH_SCREEN_SAMPLE,
  SKETCH_WIDE_STATE,
  SKETCH_WITHDRAWN,
  sketchMultiSampleOf,
  SketchRow,
} from '../design-parts/sketches/sketches-sample';

type Props = Record<string, unknown>;

const sketchRowsOf = (
  rows: SketchRow[],
  { same = [], comparing = false, known = [] }: { same?: string[]; comparing?: boolean; known?: string[] },
) =>
  rows.map((row) =>
    row.key === SKETCH_CURRENT || (!comparing && !same.includes(row.key))
      ? row
      : {
          ...row,
          shots: row.shots.map((shot) =>
            comparing
              ? known.includes(shot.state)
                ? shot
                : { ...shot, changed: null }
              : {
                  ...shot,
                  changed: false,
                  height: rows[0]?.shots.find((first) => first.state === shot.state)?.height ?? shot.height,
                },
          ),
        },
  );

const withAddedState = (rows: SketchRow[]) =>
  rows.map((row) =>
    SKETCH_ADDED_STATE.in.includes(row.key)
      ? {
          ...row,
          shots: [...row.shots, { state: SKETCH_ADDED_STATE.state, changed: true, height: SKETCH_ADDED_STATE.height }],
        }
      : row,
  );

const withWideState = (rows: SketchRow[]) =>
  rows.map((row) =>
    row.key === SKETCH_WIDE_STATE.key
      ? {
          ...row,
          shots: [
            ...row.shots,
            {
              state: SKETCH_WIDE_STATE.state,
              changed: true,
              height: SKETCH_WIDE_STATE.height,
              width: SKETCH_WIDE_STATE.width,
            },
          ],
        }
      : row,
  );

const SKETCH_PART_SAMPLES: Record<string, { rows: SketchRow[]; looks: Record<string, string> }> = {
  wide: { rows: SKETCH_ROWS, looks: {} },
  narrow: SKETCH_NARROW_SAMPLE,
  edit: SKETCH_EDIT_SAMPLE,
};

/** Replaces a design-only prop that picks sample data with the inputs that data needs. */
export const DESIGN_HARNESS_SAMPLES: Record<string, (props: Props) => Props> = {
  'components/shell-collapse': ({ class: extra, ...props }) => ({
    ...props,
    class: `${typeof extra === 'string' ? extra : ''} p-space-2`,
  }),
  'elements/canvas-frames': ({ zoom, class: extra, ...props }) => ({
    ...props,
    class: `${typeof extra === 'string' ? extra : ''} min-h-120`,
    cameraKey: 'elements/canvas-frames',
    restoredCamera: { x: 0, y: 0, zoom: parseFloat(String(zoom ?? '100%')) / 100 },
  }),
  'pages/sketches': ({
    part,
    same,
    comparing,
    known,
    added,
    wideState,
    withdrawn,
    points,
    pointsOpen,
    screen,
    multi,
    agent,
    port,
    comments,
    confirm,
    ...props
  }) => {
    const { wholeScreen, ...screenSample } = SKETCH_SCREEN_SAMPLE;
    const kind = String(part ?? 'wide');
    const partSample = SKETCH_PART_SAMPLES[kind];

    if (!partSample) throw new Error(`no sample for prop part=${kind} of part pages/sketches`);

    const run = agent === undefined ? undefined : SKETCH_AGENT_RUNS[String(agent) as keyof typeof SKETCH_AGENT_RUNS];
    const merge = port === undefined ? undefined : SKETCH_MERGE_PORTS[String(port) as keyof typeof SKETCH_MERGE_PORTS];

    if (agent !== undefined && !run)
      throw new Error(`no sample for prop agent=${String(agent)} of part pages/sketches`);
    if (port !== undefined && !merge) throw new Error(`no sample for prop port=${String(port)} of part pages/sketches`);

    const { looks: _looks, ...sample } = screen
      ? { ...screenSample, looks: {}, wholeScreens: screen === 'whole' ? [wholeScreen] : [] }
      : partSample;
    const drawn = added ? withAddedState(sample.rows) : wideState ? withWideState(sample.rows) : sample.rows;
    const rows = sketchRowsOf(drawn, {
      same: same as string[] | undefined,
      comparing: comparing === true,
      known: known as string[] | undefined,
    }).map((row) =>
      withdrawn && row.key === SKETCH_WITHDRAWN.key ? { ...row, withdrawn: SKETCH_WITHDRAWN.reason } : row,
    );

    return {
      ...props,
      ...sample,
      rows,
      ...(withdrawn ? { withdrawn } : {}),
      ...(points ? { openPoints: SKETCH_POINTS_SAMPLE, pointsClosed: pointsOpen !== true } : {}),
      ...(multi === 'three' || multi === 'many' ? sketchMultiSampleOf(multi) : {}),
      ...(run ? { agent: run } : {}),
      ...(merge ? { port: merge } : {}),
      ...(comments
        ? {
            comments: SKETCH_COMMENTS_SAMPLE,
            selectedComment: comments === 'listed' ? (SKETCH_COMMENTS_SAMPLE[0]?.id ?? null) : null,
            commentMode: comments !== 'listed',
            ...(comments === 'draft'
              ? { commentDraft: SKETCH_COMMENT_DRAFT_SAMPLE, draftText: SKETCH_COMMENT_DRAFT_TEXT }
              : {}),
          }
        : {}),
      ...(confirm === 'merge' || confirm === 'discard' ? { confirm } : {}),
    };
  },
  'pages/system': ({ build, agent, call, listingError, ...props }) => {
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
      listingError: listingError ? LISTING_ERROR_SAMPLE : null,
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
