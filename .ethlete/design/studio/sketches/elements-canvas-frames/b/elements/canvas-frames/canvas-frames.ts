import { definePart, drawing, html, slot } from '@design-system';
import { buttonStyles } from '@ethlete/components/design/button';
import button from '@system/components/button';
import { canvasViewport, canvasViewportStyles } from '@system/components/canvas-viewport';
import zoomChip from '@system/components/zoom-chip';
import {
  FAILURE_REASON,
  failureBanner,
  foldedRound,
  liveBadge,
  MARK_ACTION,
  MARK_CLASS,
  openRound,
  ROUNDS,
  type FrameMark,
  type GridHeads,
  type RoundSample,
} from '@shared/canvas-marks';
import styles from './canvas-frames.css?inline';

export type GridRow = { label: string; cells: (string | undefined)[] };
export type StateGridDrawing = { columns: string[]; rows: GridRow[] };
export type StateGridOptions = { cellWidth?: string; place?: 'fill' | 'center' };

/** The CSS for `stateGrid`, the frame parts and `canvasView`, with the zoom chip's; add it once to the drawing's styles. */
export const canvasFrameStyles = styles + buttonStyles + canvasViewportStyles;

const perLine = 4;

const restOnly = (row: GridRow) => row.cells.every((cell, index) => index === 0 || cell === undefined);

const label = (text: string, extra = '') =>
  `<span class="st-sgrid-label self-end pb-1 font-code ${extra}">${text}</span>`;

type Place = NonNullable<StateGridOptions['place']>;

const cell = (place: Place) => (body: string | undefined) =>
  `<div class="st-sgrid-cell py-space-2 px-space-1 bg-et-surface-bg ${place === 'center' ? 'grid place-items-center' : ''}">${body ?? ''}</div>`;

const tableRow =
  (place: Place) =>
  ({ label: text, cells }: GridRow) =>
    `<span class="self-center font-code">${text}</span>` + cells.map(cell(place)).join('');

const packedLine = (place: Place) => (rows: GridRow[], index: number) => {
  const blanks = '<span></span>'.repeat(perLine - rows.length);
  return (
    '<span></span>' +
    rows.map((row) => label(row.label, index === 0 ? 'pt-0' : '')).join('') +
    blanks +
    '<span></span>' +
    rows.map((row) => cell(place)(row.cells[0])).join('') +
    blanks
  );
};

const lines = (rows: GridRow[]) =>
  Array.from({ length: Math.ceil(rows.length / perLine) }, (_, index) =>
    rows.slice(index * perLine, (index + 1) * perLine),
  );

/** The body of a state grid frame: an interaction table, and the rows that use only the first column packed below it. */
export const stateGrid = (
  { columns, rows }: StateGridDrawing,
  { cellWidth = '280px', place = 'fill' }: StateGridOptions = {},
) => {
  const interactive = rows.filter((row) => !restOnly(row));
  const rest = rows.filter(restOnly);
  const interactionGroup = interactive.length
    ? `<div class="st-sgrid-group grid items-stretch gap-px">
        <span class="st-sgrid-head col-span-full mb-2 border-b border-et-surface-border pb-1 uppercase">States by interaction</span>
        <span></span>
        ${columns.map((column) => label(column)).join('')} ${interactive.map(tableRow(place)).join('')}
      </div>`
    : '';
  const restGroup = rest.length
    ? `<div class="st-sgrid-group st-sgrid-packed grid items-stretch gap-px">
        <span class="st-sgrid-head col-span-full mb-2 border-b border-et-surface-border pb-1 uppercase">Rest only</span>
        ${lines(rest).map(packedLine(place)).join('')}
      </div>`
    : '';
  return html`<div
    class="st-sgrid flex flex-col gap-6 w-max bg-et-surface-bg text-et-surface-muted pt-4 px-6 pb-6"
    data-place="${place}"
    style="--st-cols: ${columns.length}; --st-cell-w: ${cellWidth}"
  >
    ${interactionGroup} ${restGroup}
  </div>`;
};

/** The head of a frame: its name, an optional width and an optional trailing mark, set above the frame box. */
export const canvasFrameHead = (name: string, width = '', extra = '') =>
  html`<figcaption class="st-cframe-head absolute bottom-full left-0 flex pb-space-2 text-et-surface whitespace-nowrap">
    ${name}${width ? `<span class="text-et-surface-muted tabular-nums">${width}</span>` : ''}${extra}
  </figcaption>`;

/** The box of a frame: a hairline-edged surface around the body, with an optional head above it and extra classes and attributes on the box. */
export const canvasFrameBox = (body: string, head = '', { class: extra = '', attrs = '' } = {}) =>
  html`<figure class="st-cframe relative m-0 bg-et-surface-bg${extra ? ` ${extra}` : ''}" ${attrs ? ` ${attrs}` : ''}>
    ${head}${body}
  </figure>`;

/** One frame on the canvas: the head above the box, the body inside. */
export const canvasFrame = (name: string, body: string, width = '') =>
  canvasFrameBox(body, canvasFrameHead(name, width));

type ChipState = { target?: 'out' | 'reset' | 'in' | 'fit'; interaction?: 'hover' | 'active' | 'focus-visible' };

/** The canvas: the frames from the top left at the given zoom, and the zoom chip in the corner. */
export const canvasView = async (
  frames: string[],
  zoom: string,
  chipState: ChipState = {},
  extra = '',
  focusable = false,
) => {
  const chip = await zoomChip.render({
    percent: parseFloat(zoom),
    class: 'absolute right-space-3 bottom-space-3',
    ...chipState,
  });
  const body = html`<div class="flex flex-col items-start gap-30 px-10 py-12" style="zoom: ${zoom}">
      ${frames.join('')}
    </div>
    ${chip.body}`;
  const classes = `st-canvas relative h-full min-h-120 overflow-hidden ${extra}`;

  return focusable
    ? canvasViewport({ class: classes, attrs: 'data-et-skip="CLIPPED"', body })
    : html`<div class="${classes}" data-et-skip="CLIPPED">${body}</div>`;
};

type Props = {
  class?: string;
  part: string;
  states: string[];
  zoom: string;
  mark?: FrameMark;
  heads?: GridHeads;
} & ChipState;

const buttonStates = {
  filled: { label: 'Save', variant: 'filled' },
  outline: { label: 'Save', variant: 'outline' },
  tonal: { label: 'Save', variant: 'tonal' },
} as const;

const interactions = ['rest', 'hover', 'active', 'focus-visible', 'pressed', 'disabled'] as const;

type Interaction = (typeof interactions)[number];

const forcedOf = (interaction: Interaction) =>
  interaction === 'rest' || interaction === 'pressed' ? {} : { interaction };

const buttonGrid = async (states: string[], columns: readonly Interaction[] = interactions) => {
  const rows = await Promise.all(
    states.map(async (state) => {
      const base = buttonStates[state as keyof typeof buttonStates];
      const cells = await Promise.all(
        columns.map((interaction) =>
          button.render(interaction === 'pressed' ? { ...base, pressed: true } : base, forcedOf(interaction)),
        ),
      );
      return { label: state, cells: cells.map((c) => c.body) };
    }),
  );
  return stateGrid({ columns: [...columns], rows }, { cellWidth: '120px', place: 'center' });
};

const loadingBody = `<div class="h-72 w-4xl" aria-busy="true" data-loading></div>`;

const markedFrame = async (name: string, body: string, mark?: FrameMark) => {
  const action = MARK_ACTION[mark ?? 'rest'];

  return canvasFrameBox(
    mark === 'loading' ? loadingBody : mark === 'failed' ? body + (await failureBanner(FAILURE_REASON)) : body,
    canvasFrameHead(name, '', mark === 'active' ? liveBadge : mark === 'loading' ? '' : ''),
    {
      class: mark ? MARK_CLASS[mark] : '',
      attrs: [action && `data-et-action="${action}"`, mark && `data-${mark}`].filter(Boolean).join(' '),
    },
  );
};

const roundOf = async (part: string, round: RoundSample) => ({
  ...round,
  columns: await Promise.all(
    round.columns.map(async (column) => ({
      ...column,
      frame: canvasFrame(`${part} · ${column.label}`, await buttonGrid(['filled'], ['rest', 'hover', 'pressed'])),
    })),
  ),
});

const gridOf = async (part: string, heads: GridHeads) =>
  heads === 'open'
    ? openRound(await roundOf(part, ROUNDS.first))
    : html`<div class="flex items-start gap-20">
        ${await foldedRound(ROUNDS.first)} ${await openRound(await roundOf(part, ROUNDS.second))}
      </div>`;

const ZOOM = { kind: 'button', part: 'components/zoom-chip' } as const;

const defaultFrames: Props = {
  part: 'button',
  states: ['filled', 'outline', 'tonal'],
  zoom: '100%',
  class: 'w-250',
};

export default definePart({
  implements: 'apps/ethlete-studio/src/app/design-parts/canvas-frames/canvas-frames.component.ts',
  note: 'The frames of one part on the canvas, in the state grid look: a sunken frame body, the cells as one component sheet with hairline dividers, labels outside the sheet. A click selects a frame (a 2 px primary outline), a second click on the selected frame, the double click, makes it live (a dashed outline and the Live · Esc badge in its head; Escape leaves it). A frame keeps following the size of its content; it has no size control. A frame whose page failed to load shows the reason and Neu laden on top of it. On the variant grid each round has a head: its title folds the round to one narrow column with its note, the switch beside it shows the unchanged states; a column head names the variant above its frames. The element also exports that look (stateGrid, canvasFrameHead, canvasFrameBox, canvasFrame, canvasView, canvasFrameStyles) for pages that draw their own frames; canvasView places components/zoom-chip in the corner. It fills its container and leaves room for a side panel through --st-shell-inset-left.',
  madeBy: ['claude-opus-5-5', 'claude-sonnet-5-5'],
  widths: [1440],
  unreachable: [
    {
      from: 'default',
      to: 'out',
      reason:
        'Every state is one canvas at rest with a single zoom control forced to hover; the canvas never moves between them.',
    },
    {
      from: 'default',
      to: 'reset',
      reason:
        'Every state is one canvas at rest with a single zoom control forced to hover; the canvas never moves between them.',
    },
    {
      from: 'default',
      to: 'in',
      reason:
        'Every state is one canvas at rest with a single zoom control forced to hover; the canvas never moves between them.',
    },
    {
      from: 'default',
      to: 'fit',
      reason:
        'Every state is one canvas at rest with a single zoom control forced to hover; the canvas never moves between them.',
    },
    {
      from: 'default',
      to: 'selected',
      reason:
        'A click, the second click and Escape swap the outline and the Live badge at once; no motion runs between them.',
    },
    {
      from: 'default',
      to: 'active',
      reason:
        'A click, the second click and Escape swap the outline and the Live badge at once; no motion runs between them.',
    },
    {
      from: 'default',
      to: 'load-failed',
      reason:
        'A failed load is the result of a page fetch, not a step from another state; the banner shows at once with no motion.',
    },
    {
      from: 'default',
      to: 'rounds',
      reason:
        'The variant grid of a sketch and the single frame of a part are different canvases; no step leads from one to the other.',
    },
    {
      from: 'default',
      to: 'round-folded',
      reason:
        'The variant grid of a sketch and the single frame of a part are different canvases; no step leads from one to the other.',
    },
    {
      from: 'out',
      to: 'default',
      reason:
        'Every state is one canvas at rest with a single zoom control forced to hover; the canvas never moves between them.',
    },
    {
      from: 'out',
      to: 'reset',
      reason:
        'Every state is one canvas at rest with a single zoom control forced to hover; the canvas never moves between them.',
    },
    {
      from: 'out',
      to: 'in',
      reason:
        'Every state is one canvas at rest with a single zoom control forced to hover; the canvas never moves between them.',
    },
    {
      from: 'out',
      to: 'fit',
      reason:
        'Every state is one canvas at rest with a single zoom control forced to hover; the canvas never moves between them.',
    },
    {
      from: 'out',
      to: 'selected',
      reason:
        'A zoom state holds the canvas at rest with the zoom control forced to hover; selecting a frame is no step from it and changes no zoom.',
    },
    {
      from: 'out',
      to: 'active',
      reason:
        'A zoom state holds the canvas at rest with the zoom control forced to hover; selecting a frame is no step from it and changes no zoom.',
    },
    {
      from: 'out',
      to: 'load-failed',
      reason:
        'A failed load is the result of a page fetch, not a step from another state; the banner shows at once with no motion.',
    },
    {
      from: 'out',
      to: 'rounds',
      reason:
        'The variant grid of a sketch and the single frame of a part are different canvases; no step leads from one to the other.',
    },
    {
      from: 'out',
      to: 'round-folded',
      reason:
        'The variant grid of a sketch and the single frame of a part are different canvases; no step leads from one to the other.',
    },
    {
      from: 'reset',
      to: 'default',
      reason:
        'Every state is one canvas at rest with a single zoom control forced to hover; the canvas never moves between them.',
    },
    {
      from: 'reset',
      to: 'out',
      reason:
        'Every state is one canvas at rest with a single zoom control forced to hover; the canvas never moves between them.',
    },
    {
      from: 'reset',
      to: 'in',
      reason:
        'Every state is one canvas at rest with a single zoom control forced to hover; the canvas never moves between them.',
    },
    {
      from: 'reset',
      to: 'fit',
      reason:
        'Every state is one canvas at rest with a single zoom control forced to hover; the canvas never moves between them.',
    },
    {
      from: 'reset',
      to: 'selected',
      reason:
        'A zoom state holds the canvas at rest with the zoom control forced to hover; selecting a frame is no step from it and changes no zoom.',
    },
    {
      from: 'reset',
      to: 'active',
      reason:
        'A zoom state holds the canvas at rest with the zoom control forced to hover; selecting a frame is no step from it and changes no zoom.',
    },
    {
      from: 'reset',
      to: 'load-failed',
      reason:
        'A failed load is the result of a page fetch, not a step from another state; the banner shows at once with no motion.',
    },
    {
      from: 'reset',
      to: 'rounds',
      reason:
        'The variant grid of a sketch and the single frame of a part are different canvases; no step leads from one to the other.',
    },
    {
      from: 'reset',
      to: 'round-folded',
      reason:
        'The variant grid of a sketch and the single frame of a part are different canvases; no step leads from one to the other.',
    },
    {
      from: 'in',
      to: 'default',
      reason:
        'Every state is one canvas at rest with a single zoom control forced to hover; the canvas never moves between them.',
    },
    {
      from: 'in',
      to: 'out',
      reason:
        'Every state is one canvas at rest with a single zoom control forced to hover; the canvas never moves between them.',
    },
    {
      from: 'in',
      to: 'reset',
      reason:
        'Every state is one canvas at rest with a single zoom control forced to hover; the canvas never moves between them.',
    },
    {
      from: 'in',
      to: 'fit',
      reason:
        'Every state is one canvas at rest with a single zoom control forced to hover; the canvas never moves between them.',
    },
    {
      from: 'in',
      to: 'selected',
      reason:
        'A zoom state holds the canvas at rest with the zoom control forced to hover; selecting a frame is no step from it and changes no zoom.',
    },
    {
      from: 'in',
      to: 'active',
      reason:
        'A zoom state holds the canvas at rest with the zoom control forced to hover; selecting a frame is no step from it and changes no zoom.',
    },
    {
      from: 'in',
      to: 'load-failed',
      reason:
        'A failed load is the result of a page fetch, not a step from another state; the banner shows at once with no motion.',
    },
    {
      from: 'in',
      to: 'rounds',
      reason:
        'The variant grid of a sketch and the single frame of a part are different canvases; no step leads from one to the other.',
    },
    {
      from: 'in',
      to: 'round-folded',
      reason:
        'The variant grid of a sketch and the single frame of a part are different canvases; no step leads from one to the other.',
    },
    {
      from: 'fit',
      to: 'default',
      reason:
        'Every state is one canvas at rest with a single zoom control forced to hover; the canvas never moves between them.',
    },
    {
      from: 'fit',
      to: 'out',
      reason:
        'Every state is one canvas at rest with a single zoom control forced to hover; the canvas never moves between them.',
    },
    {
      from: 'fit',
      to: 'reset',
      reason:
        'Every state is one canvas at rest with a single zoom control forced to hover; the canvas never moves between them.',
    },
    {
      from: 'fit',
      to: 'in',
      reason:
        'Every state is one canvas at rest with a single zoom control forced to hover; the canvas never moves between them.',
    },
    {
      from: 'fit',
      to: 'selected',
      reason:
        'A zoom state holds the canvas at rest with the zoom control forced to hover; selecting a frame is no step from it and changes no zoom.',
    },
    {
      from: 'fit',
      to: 'active',
      reason:
        'A zoom state holds the canvas at rest with the zoom control forced to hover; selecting a frame is no step from it and changes no zoom.',
    },
    {
      from: 'fit',
      to: 'load-failed',
      reason:
        'A failed load is the result of a page fetch, not a step from another state; the banner shows at once with no motion.',
    },
    {
      from: 'fit',
      to: 'rounds',
      reason:
        'The variant grid of a sketch and the single frame of a part are different canvases; no step leads from one to the other.',
    },
    {
      from: 'fit',
      to: 'round-folded',
      reason:
        'The variant grid of a sketch and the single frame of a part are different canvases; no step leads from one to the other.',
    },
    {
      from: 'selected',
      to: 'default',
      reason:
        'A click, the second click and Escape swap the outline and the Live badge at once; no motion runs between them.',
    },
    {
      from: 'selected',
      to: 'out',
      reason:
        'A zoom state holds the canvas at rest with the zoom control forced to hover; selecting a frame is no step from it and changes no zoom.',
    },
    {
      from: 'selected',
      to: 'reset',
      reason:
        'A zoom state holds the canvas at rest with the zoom control forced to hover; selecting a frame is no step from it and changes no zoom.',
    },
    {
      from: 'selected',
      to: 'in',
      reason:
        'A zoom state holds the canvas at rest with the zoom control forced to hover; selecting a frame is no step from it and changes no zoom.',
    },
    {
      from: 'selected',
      to: 'fit',
      reason:
        'A zoom state holds the canvas at rest with the zoom control forced to hover; selecting a frame is no step from it and changes no zoom.',
    },
    {
      from: 'selected',
      to: 'active',
      reason:
        'A click, the second click and Escape swap the outline and the Live badge at once; no motion runs between them.',
    },
    {
      from: 'selected',
      to: 'load-failed',
      reason:
        'A failed load is the result of a page fetch, not a step from another state; the banner shows at once with no motion.',
    },
    {
      from: 'selected',
      to: 'rounds',
      reason:
        'The variant grid of a sketch and the single frame of a part are different canvases; no step leads from one to the other.',
    },
    {
      from: 'selected',
      to: 'round-folded',
      reason:
        'The variant grid of a sketch and the single frame of a part are different canvases; no step leads from one to the other.',
    },
    {
      from: 'active',
      to: 'default',
      reason:
        'A click, the second click and Escape swap the outline and the Live badge at once; no motion runs between them.',
    },
    {
      from: 'active',
      to: 'out',
      reason:
        'A zoom state holds the canvas at rest with the zoom control forced to hover; selecting a frame is no step from it and changes no zoom.',
    },
    {
      from: 'active',
      to: 'reset',
      reason:
        'A zoom state holds the canvas at rest with the zoom control forced to hover; selecting a frame is no step from it and changes no zoom.',
    },
    {
      from: 'active',
      to: 'in',
      reason:
        'A zoom state holds the canvas at rest with the zoom control forced to hover; selecting a frame is no step from it and changes no zoom.',
    },
    {
      from: 'active',
      to: 'fit',
      reason:
        'A zoom state holds the canvas at rest with the zoom control forced to hover; selecting a frame is no step from it and changes no zoom.',
    },
    {
      from: 'active',
      to: 'selected',
      reason:
        'A click, the second click and Escape swap the outline and the Live badge at once; no motion runs between them.',
    },
    {
      from: 'active',
      to: 'load-failed',
      reason:
        'A failed load is the result of a page fetch, not a step from another state; the banner shows at once with no motion.',
    },
    {
      from: 'active',
      to: 'rounds',
      reason:
        'The variant grid of a sketch and the single frame of a part are different canvases; no step leads from one to the other.',
    },
    {
      from: 'active',
      to: 'round-folded',
      reason:
        'The variant grid of a sketch and the single frame of a part are different canvases; no step leads from one to the other.',
    },
    {
      from: 'load-failed',
      to: 'default',
      reason:
        'A failed load is the result of a page fetch, not a step from another state; the banner shows at once with no motion.',
    },
    {
      from: 'load-failed',
      to: 'out',
      reason:
        'A failed load is the result of a page fetch, not a step from another state; the banner shows at once with no motion.',
    },
    {
      from: 'load-failed',
      to: 'reset',
      reason:
        'A failed load is the result of a page fetch, not a step from another state; the banner shows at once with no motion.',
    },
    {
      from: 'load-failed',
      to: 'in',
      reason:
        'A failed load is the result of a page fetch, not a step from another state; the banner shows at once with no motion.',
    },
    {
      from: 'load-failed',
      to: 'fit',
      reason:
        'A failed load is the result of a page fetch, not a step from another state; the banner shows at once with no motion.',
    },
    {
      from: 'load-failed',
      to: 'selected',
      reason:
        'A failed load is the result of a page fetch, not a step from another state; the banner shows at once with no motion.',
    },
    {
      from: 'load-failed',
      to: 'active',
      reason:
        'A failed load is the result of a page fetch, not a step from another state; the banner shows at once with no motion.',
    },
    {
      from: 'load-failed',
      to: 'rounds',
      reason:
        'The variant grid of a sketch and the single frame of a part are different canvases; no step leads from one to the other.',
    },
    {
      from: 'load-failed',
      to: 'round-folded',
      reason:
        'The variant grid of a sketch and the single frame of a part are different canvases; no step leads from one to the other.',
    },
    {
      from: 'rounds',
      to: 'default',
      reason:
        'The variant grid of a sketch and the single frame of a part are different canvases; no step leads from one to the other.',
    },
    {
      from: 'rounds',
      to: 'out',
      reason:
        'The variant grid of a sketch and the single frame of a part are different canvases; no step leads from one to the other.',
    },
    {
      from: 'rounds',
      to: 'reset',
      reason:
        'The variant grid of a sketch and the single frame of a part are different canvases; no step leads from one to the other.',
    },
    {
      from: 'rounds',
      to: 'in',
      reason:
        'The variant grid of a sketch and the single frame of a part are different canvases; no step leads from one to the other.',
    },
    {
      from: 'rounds',
      to: 'fit',
      reason:
        'The variant grid of a sketch and the single frame of a part are different canvases; no step leads from one to the other.',
    },
    {
      from: 'rounds',
      to: 'selected',
      reason:
        'The variant grid of a sketch and the single frame of a part are different canvases; no step leads from one to the other.',
    },
    {
      from: 'rounds',
      to: 'active',
      reason:
        'The variant grid of a sketch and the single frame of a part are different canvases; no step leads from one to the other.',
    },
    {
      from: 'rounds',
      to: 'load-failed',
      reason:
        'The variant grid of a sketch and the single frame of a part are different canvases; no step leads from one to the other.',
    },
    {
      from: 'rounds',
      to: 'round-folded',
      reason: 'Folding or unfolding a round lays the grid out again at once; no motion runs between them.',
    },
    {
      from: 'round-folded',
      to: 'default',
      reason:
        'The variant grid of a sketch and the single frame of a part are different canvases; no step leads from one to the other.',
    },
    {
      from: 'round-folded',
      to: 'out',
      reason:
        'The variant grid of a sketch and the single frame of a part are different canvases; no step leads from one to the other.',
    },
    {
      from: 'round-folded',
      to: 'reset',
      reason:
        'The variant grid of a sketch and the single frame of a part are different canvases; no step leads from one to the other.',
    },
    {
      from: 'round-folded',
      to: 'in',
      reason:
        'The variant grid of a sketch and the single frame of a part are different canvases; no step leads from one to the other.',
    },
    {
      from: 'round-folded',
      to: 'fit',
      reason:
        'The variant grid of a sketch and the single frame of a part are different canvases; no step leads from one to the other.',
    },
    {
      from: 'round-folded',
      to: 'selected',
      reason:
        'The variant grid of a sketch and the single frame of a part are different canvases; no step leads from one to the other.',
    },
    {
      from: 'round-folded',
      to: 'active',
      reason:
        'The variant grid of a sketch and the single frame of a part are different canvases; no step leads from one to the other.',
    },
    {
      from: 'round-folded',
      to: 'load-failed',
      reason:
        'The variant grid of a sketch and the single frame of a part are different canvases; no step leads from one to the other.',
    },
    {
      from: 'round-folded',
      to: 'rounds',
      reason: 'Folding or unfolding a round lays the grid out again at once; no motion runs between them.',
    },
    {
      from: 'default',
      to: 'loading',
      reason: 'A frame starts in the loading state when its page is fetched; no step from default leads into it.',
    },
    {
      from: 'loading',
      to: 'default',
      reason: 'The loaded or failed frame replaces the loading frame at once; no motion runs between them.',
    },
    {
      from: 'out',
      to: 'loading',
      reason: 'A frame starts in the loading state when its page is fetched; no step from out leads into it.',
    },
    {
      from: 'loading',
      to: 'out',
      reason: 'The loaded or failed frame replaces the loading frame at once; no motion runs between them.',
    },
    {
      from: 'reset',
      to: 'loading',
      reason: 'A frame starts in the loading state when its page is fetched; no step from reset leads into it.',
    },
    {
      from: 'loading',
      to: 'reset',
      reason: 'The loaded or failed frame replaces the loading frame at once; no motion runs between them.',
    },
    {
      from: 'in',
      to: 'loading',
      reason: 'A frame starts in the loading state when its page is fetched; no step from in leads into it.',
    },
    {
      from: 'loading',
      to: 'in',
      reason: 'The loaded or failed frame replaces the loading frame at once; no motion runs between them.',
    },
    {
      from: 'fit',
      to: 'loading',
      reason: 'A frame starts in the loading state when its page is fetched; no step from fit leads into it.',
    },
    {
      from: 'loading',
      to: 'fit',
      reason: 'The loaded or failed frame replaces the loading frame at once; no motion runs between them.',
    },
    {
      from: 'selected',
      to: 'loading',
      reason: 'A frame starts in the loading state when its page is fetched; no step from selected leads into it.',
    },
    {
      from: 'loading',
      to: 'selected',
      reason: 'The loaded or failed frame replaces the loading frame at once; no motion runs between them.',
    },
    {
      from: 'active',
      to: 'loading',
      reason: 'A frame starts in the loading state when its page is fetched; no step from active leads into it.',
    },
    {
      from: 'loading',
      to: 'active',
      reason: 'The loaded or failed frame replaces the loading frame at once; no motion runs between them.',
    },
    {
      from: 'load-failed',
      to: 'loading',
      reason: 'A frame starts in the loading state when its page is fetched; no step from load-failed leads into it.',
    },
    {
      from: 'loading',
      to: 'load-failed',
      reason: 'The loaded or failed frame replaces the loading frame at once; no motion runs between them.',
    },
    {
      from: 'rounds',
      to: 'loading',
      reason: 'A frame starts in the loading state when its page is fetched; no step from rounds leads into it.',
    },
    {
      from: 'loading',
      to: 'rounds',
      reason: 'The loaded or failed frame replaces the loading frame at once; no motion runs between them.',
    },
    {
      from: 'round-folded',
      to: 'loading',
      reason: 'A frame starts in the loading state when its page is fetched; no step from round-folded leads into it.',
    },
    {
      from: 'loading',
      to: 'round-folded',
      reason: 'The loaded or failed frame replaces the loading frame at once; no motion runs between them.',
    },
    {
      from: 'loading',
      to: 'loading',
      reason: 'The quiet placeholder is an empty box; nothing moves while it waits.',
    },
  ],
  states: {
    default: defaultFrames,
    out: { ...defaultFrames, zoom: '25%', target: 'out', interaction: 'hover' },
    reset: { ...defaultFrames, target: 'reset', interaction: 'hover' },
    in: { ...defaultFrames, zoom: '250%', target: 'in', interaction: 'hover' },
    fit: { ...defaultFrames, target: 'fit', interaction: 'hover' },
    selected: { ...defaultFrames, mark: 'selected' },
    active: { ...defaultFrames, mark: 'active' },
    'load-failed': { ...defaultFrames, mark: 'failed' },
    loading: { ...defaultFrames, mark: 'loading' },
    rounds: { ...defaultFrames, zoom: '75%', heads: 'open' },
    'round-folded': { ...defaultFrames, zoom: '75%', heads: 'folded' },
  },
  controls: {
    button: { kind: 'button', part: 'components/button' },
    out: ZOOM,
    reset: ZOOM,
    in: ZOOM,
    fit: ZOOM,
  },
  render: async ({ class: extra, part, states, zoom, target, interaction, mark, heads }: Props) => {
    const frames = heads ? await gridOf(part, heads) : await markedFrame(part, await buttonGrid(states), mark);

    return drawing({
      body: await canvasView(
        [html`<div class="contents" ${slot('frames')}>${frames}</div>`],
        zoom,
        {
          target,
          interaction,
        },
        extra,
        true,
      ),
      styles: canvasFrameStyles,
    });
  },
});
