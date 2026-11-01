import { definePart, drawing, html, slot } from '@design-system';
import { buttonStyles } from '@ethlete/components/design/button';
import button from '@system/components/button';
import zoomChip from '@system/components/zoom-chip';
import styles from './canvas-frames.css?inline';

export type GridRow = { label: string; cells: (string | undefined)[] };
export type StateGridDrawing = { columns: string[]; rows: GridRow[] };
export type StateGridOptions = { cellWidth?: string; place?: 'fill' | 'center' };

/** The CSS for `stateGrid`, the frame parts and `canvasView`, with the zoom chip's; add it once to the drawing's styles. */
export const canvasFrameStyles = styles + buttonStyles;

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

/** The head of a frame: its name and optional width, set above the frame box. */
export const canvasFrameHead = (name: string, width = '') =>
  html`<figcaption class="st-cframe-head absolute bottom-full left-0 flex pb-space-2 text-et-surface whitespace-nowrap">
    ${name}${width ? `<span class="text-et-surface-muted tabular-nums">${width}</span>` : ''}
  </figcaption>`;

/** The box of a frame: a hairline-edged surface around the body, with an optional head above it. */
export const canvasFrameBox = (body: string, head = '') =>
  html`<figure class="st-cframe relative m-0 bg-et-surface-bg">${head}${body}</figure>`;

/** One frame on the canvas: the head above the box, the body inside. */
export const canvasFrame = (name: string, body: string, width = '') =>
  canvasFrameBox(body, canvasFrameHead(name, width));

type ChipState = { target?: 'out' | 'reset' | 'in' | 'fit'; interaction?: 'hover' | 'active' | 'focus-visible' };

/** The canvas: the frames from the top left at the given zoom, and the zoom chip in the corner. */
export const canvasView = async (frames: string[], zoom: string, chipState: ChipState = {}) => {
  const chip = await zoomChip.render({
    percent: parseFloat(zoom),
    class: 'absolute right-space-3 bottom-space-3',
    ...chipState,
  });
  return html`<div class="st-canvas relative h-full min-h-120 overflow-hidden" data-et-skip="CLIPPED">
    <div class="flex flex-col items-start gap-30 px-10 py-12" style="zoom: ${zoom}">${frames.join('')}</div>
    ${chip.body}
  </div>`;
};

type Props = { part: string; states: string[]; zoom: string } & ChipState;

const buttonStates = {
  filled: { label: 'Save', variant: 'filled' },
  outline: { label: 'Save', variant: 'outline' },
  tonal: { label: 'Save', variant: 'tonal' },
} as const;

const interactions = ['rest', 'hover', 'active', 'focus-visible', 'pressed', 'disabled'] as const;

const forcedOf = (interaction: (typeof interactions)[number]) =>
  interaction === 'rest' || interaction === 'pressed' ? {} : { interaction };

const ZOOM = { kind: 'button', part: 'components/zoom-chip' } as const;

const defaultFrames: Props = {
  part: 'button',
  states: ['filled', 'outline', 'tonal'],
  zoom: '100%',
};

export default definePart({
  implements: 'apps/ethlete-studio/src/app/design-parts/canvas-frames/canvas-frames.component.ts',
  note: 'The frames of one part on the canvas, in the state grid look: a sunken frame body, the cells as one component sheet with hairline dividers, labels outside the sheet. The element also exports that look (stateGrid, canvasFrameHead, canvasFrameBox, canvasFrame, canvasView, canvasFrameStyles) for pages that draw their own frames; canvasView places components/zoom-chip in the corner. It fills its container and leaves room for a side panel through --st-shell-inset-left.',
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
  ],
  states: {
    default: defaultFrames,
    out: { ...defaultFrames, zoom: '25%', target: 'out', interaction: 'hover' },
    reset: { ...defaultFrames, target: 'reset', interaction: 'hover' },
    in: { ...defaultFrames, zoom: '250%', target: 'in', interaction: 'hover' },
    fit: { ...defaultFrames, target: 'fit', interaction: 'hover' },
  },
  controls: {
    button: { kind: 'button', part: 'components/button' },
    out: ZOOM,
    reset: ZOOM,
    in: ZOOM,
    fit: ZOOM,
  },
  render: async ({ part, states, zoom, target, interaction }: Props) => {
    const rows = await Promise.all(
      states.map(async (state) => {
        const base = buttonStates[state as keyof typeof buttonStates];
        const cells = await Promise.all(
          interactions.map((interaction) =>
            button.render(interaction === 'pressed' ? { ...base, pressed: true } : base, forcedOf(interaction)),
          ),
        );
        return { label: state, cells };
      }),
    );
    const grid = stateGrid(
      {
        columns: [...interactions],
        rows: rows.map(({ label, cells }) => ({ label, cells: cells.map((c) => c.body) })),
      },
      { cellWidth: '120px', place: 'center' },
    );
    return drawing({
      body: await canvasView([html`<div class="contents" ${slot('frames')}>${canvasFrame(part, grid)}</div>`], zoom, {
        target,
        interaction,
      }),
      styles: canvasFrameStyles,
    });
  },
});
