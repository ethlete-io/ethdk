import { StaticProvider, Type } from '@angular/core';
import { CANVAS_LIVE_REST_MS } from '../components/design-canvas/design-canvas.component';
import { FRAME_UNREPORTED_PAINT_MS } from '../components/design-canvas/frame-paint';
import {
  AGENT_ON_READY_PART_SAMPLE,
  AGENT_SAMPLES,
  buildReadySampleOf,
  BuildReadySample,
  LEGACY_CALL_SAMPLE,
  LISTING_ERROR_SAMPLE,
  OPEN_POINTS_SAMPLE,
  FOLDED_STATES_SAMPLE,
  PART_EXCEPTIONS_SAMPLE,
  SYSTEM_COMMENT_WRITER_SAMPLE,
  SYSTEM_COMMENTS_SAMPLE,
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

type FrameSize = { width: number; height: number };

const paintedPageOf = ({ width, height }: FrameSize) =>
  `data:text/html,<script>parent.postMessage({ type: 'design-explore:height', height: ${height}, width: ${width} }, '*');parent.postMessage({ type: 'design-explore:painted' }, '*')</script>`;

const LOADING_PAGE = `data:text/html,<script>parent.postMessage({ type: 'design-explore:loading' }, '*')</script>`;

const frameShotOf = ({ width, height }: FrameSize) =>
  `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"/>`;

const GRID_FRAME_SIZE = { width: 944, height: 224 };

const LOADING_FRAME_SIZE = { width: 560, height: 288 };

const REFUSED_PAGE = 'http://127.0.0.1:9/';

const CANVAS_FRAME_SOURCES = {
  rest: { src: paintedPageOf(GRID_FRAME_SIZE), screenshot: frameShotOf(GRID_FRAME_SIZE) },
  selected: { src: paintedPageOf(GRID_FRAME_SIZE), screenshot: frameShotOf(GRID_FRAME_SIZE) },
  active: { src: paintedPageOf(GRID_FRAME_SIZE), screenshot: frameShotOf(GRID_FRAME_SIZE) },
  loading: { src: LOADING_PAGE, screenshot: frameShotOf(LOADING_FRAME_SIZE) },
  failed: { src: REFUSED_PAGE, screenshot: frameShotOf(GRID_FRAME_SIZE) },
};

type CanvasRound = { key: string; title: string; note: string; columns: { label: string; note: string }[] };

const CANVAS_ROUNDS: [CanvasRound, CanvasRound] = [
  {
    key: 'round-1',
    title: 'Runde 1 · Fenstertasten',
    note: 'Kachel oder runde Taste unter Windows',
    columns: [
      { label: 'a', note: 'Caption-Form im SDK' },
      { label: 'b', note: 'Nur in Studio' },
    ],
  },
  {
    key: 'round-2',
    title: 'Runde 2 · Kombination',
    note: 'Kachel aus a, Fokus aus b',
    columns: [{ label: 'c', note: 'Kombination' }],
  },
];

const ROUND_FRAME_SIZE = { width: 556, height: 132 };

const ROUND_HEADS_ROOM = 68;

const ROUND_GROUP_HEAD_SCREEN = 27.5;

const ROUND_COLUMN_HEAD_SCREEN = 1.4 * (16 + 12.8);

const ROUND_HEADS_SCREEN = ROUND_GROUP_HEAD_SCREEN + ROUND_COLUMN_HEAD_SCREEN;

const openColumnsOf = (part: string, round: CanvasRound) => {
  const group = {
    key: round.key,
    label: round.title,
    note: round.note,
    switch: { label: 'Unveränderte Zustände zeigen', on: false },
  };

  return {
    columns: round.columns.map(({ label, note }) => ({ key: label, label, note, group })),
    frames: round.columns.map(({ label }) => ({
      id: `${part}-${label}`,
      label: `${part} · ${label}`,
      column: label,
      src: paintedPageOf(ROUND_FRAME_SIZE),
      screenshot: frameShotOf(ROUND_FRAME_SIZE),
    })),
  };
};

const roundsOf = (part: string, heads: 'open' | 'folded') => {
  const [first, second] = CANVAS_ROUNDS;

  if (heads === 'open') return { arrangement: 'matrix', ...openColumnsOf(part, first) };

  const open = openColumnsOf(part, second);

  return {
    arrangement: 'matrix',
    columns: [{ key: first.key, label: first.title, folded: { width: 240, note: first.note } }, ...open.columns],
    frames: open.frames,
  };
};

const DIFF_CELL_SIZE = { width: 220, height: 96 };

const DIFF_INTERACTIONS = ['rest', 'hover', 'active', 'focus-visible'];

const DIFF_BOXES = {
  trigger: { x: 8, y: 8, width: 120, height: 28 },
  reason: { x: 8, y: 48, width: 150, height: 20 },
  both: { x: 8, y: 8, width: 150, height: 60 },
};

const diffUrlOf = (box: (typeof DIFF_BOXES)[keyof typeof DIFF_BOXES]) =>
  `data:application/json,${encodeURIComponent(JSON.stringify({ box, frame: DIFF_CELL_SIZE }))}`;

const diffBoxOf = (open: boolean, interaction: string) => {
  if (open && interaction !== 'rest') return DIFF_BOXES.both;
  if (open) return DIFF_BOXES.reason;
  if (interaction !== 'rest') return DIFF_BOXES.trigger;
  return null;
};

const diffFramesOf = (part: string) => [
  {
    id: part,
    src: '',
    label: part,
    grid: {
      sheet: 'table',
      columns: DIFF_INTERACTIONS,
      rows: ['closed', 'open'],
      cells: ['closed', 'open'].flatMap((row) =>
        DIFF_INTERACTIONS.map((interaction) => {
          const box = diffBoxOf(row === 'open', interaction);

          return {
            id: `${part}-${row}-${interaction}`,
            row,
            column: interaction,
            label: `${row} · ${interaction}`,
            src: paintedPageOf(DIFF_CELL_SIZE),
            screenshot: frameShotOf(DIFF_CELL_SIZE),
            ...(box ? { diff: diffUrlOf(box) } : {}),
          };
        }),
      ),
    },
  },
];

/** Replaces a design-only prop that picks sample data with the inputs that data needs. */
export const DESIGN_HARNESS_SAMPLES: Record<string, (props: Props) => Props> = {
  'components/comment-pin': ({ class: extra, ...props }) => ({
    ...props,
    class: `${typeof extra === 'string' ? extra : ''} p-space-2`,
  }),
  'components/shell-collapse': ({ class: extra, ...props }) => ({
    ...props,
    class: `${typeof extra === 'string' ? extra : ''} p-space-2`,
  }),
  'elements/canvas-frames': ({ zoom, class: extra, part, states: _states, mark, heads, diff, ...props }) => {
    const scale = parseFloat(String(zoom ?? '100%')) / 100;
    const id = String(part);
    const kind = (mark ?? 'rest') as keyof typeof CANVAS_FRAME_SOURCES;

    return {
      ...props,
      class: `${typeof extra === 'string' ? extra : ''} min-h-120`,
      ...(diff
        ? { frames: diffFramesOf('hold-trigger') }
        : heads === 'open' || heads === 'folded'
          ? roundsOf(id, heads)
          : { frames: [{ id, label: id, ...CANVAS_FRAME_SOURCES[kind] }] }),
      selectedId: mark === 'selected' || mark === 'active' ? id : null,
      activeId: mark === 'active' ? id : null,
      cameraKey: 'elements/canvas-frames',
      restoredCamera: {
        x: 40 * scale,
        // The design rounds the room above its round bodies to 4 canvas px.
        y: (heads ? 48 + Math.round((ROUND_HEADS_ROOM + ROUND_HEADS_SCREEN / scale) / 4) * 4 : 48) * scale,
        zoom: scale,
      },
    };
  },
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
  'pages/system': ({ build, agent, call, listingError, folded, comments, ...props }) => {
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
      foldedStates: folded ? FOLDED_STATES_SAMPLE : 0,
      ...(props['noted'] ? { tree: { layers: [] } } : {}),
      ...(comments
        ? {
            comments: SYSTEM_COMMENTS_SAMPLE,
            selectedComment: props['draft'] === undefined ? (SYSTEM_COMMENTS_SAMPLE[0]?.id ?? null) : null,
            writer: SYSTEM_COMMENT_WRITER_SAMPLE,
          }
        : {}),
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

/** Providers the harness mounts a part with, beside its own. */
export const DESIGN_HARNESS_PROVIDERS: Record<string, StaticProvider[]> = {
  'elements/canvas-frames': [
    { provide: FRAME_UNREPORTED_PAINT_MS, useValue: 0 },
    { provide: CANVAS_LIVE_REST_MS, useValue: 0 },
  ],
};
