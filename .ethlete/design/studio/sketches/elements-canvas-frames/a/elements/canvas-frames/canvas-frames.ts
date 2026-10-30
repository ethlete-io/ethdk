import { definePart, drawing, html } from '@design-system';
import { buttonStyles } from '@ethlete/components/design/button';
import button from '@system/components/button';
import styles from './canvas-frames.css?inline';

export type GridRow = { label: string; cells: (string | undefined)[] };
export type StateGridDrawing = { columns: string[]; rows: GridRow[] };
export type StateGridOptions = { cellWidth?: string; place?: 'fill' | 'center' };

/** The CSS for `stateGrid`, the frame parts, the zoom chip and `canvasView`; add it once to the drawing's styles. */
export const canvasFrameStyles = styles + buttonStyles;

const perLine = 4;

const restOnly = (row: GridRow) => row.cells.every((cell, index) => index === 0 || cell === undefined);

const label = (text: string, extra = '') =>
  `<span class="st-sgrid-label self-end pb-1 font-code${extra}">${text}</span>`;

type Place = NonNullable<StateGridOptions['place']>;

const cell = (place: Place) => (body: string | undefined) =>
  `<div class="st-sgrid-cell py-space-2 px-space-1 bg-surface${place === 'center' ? ' grid place-items-center' : ''}">${body ?? ''}</div>`;

const tableRow =
  (place: Place) =>
  ({ label: text, cells }: GridRow) =>
    `<span class="self-center font-code">${text}</span>` + cells.map(cell(place)).join('');

const packedLine = (place: Place) => (rows: GridRow[], index: number) => {
  const blanks = '<span></span>'.repeat(perLine - rows.length);
  return (
    '<span></span>' +
    rows.map((row) => label(row.label, index === 0 ? ' pt-0' : '')).join('') +
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
        <span class="st-sgrid-head col-span-full mb-2 border-b border-surface-border pb-1 uppercase">States by interaction</span>
        <span></span>
        ${columns.map((column) => label(column)).join('')} ${interactive.map(tableRow(place)).join('')}
      </div>`
    : '';
  const restGroup = rest.length
    ? `<div class="st-sgrid-group st-sgrid-packed grid items-stretch gap-px">
        <span class="st-sgrid-head col-span-full mb-2 border-b border-surface-border pb-1 uppercase">Rest only</span>
        ${lines(rest).map(packedLine(place)).join('')}
      </div>`
    : '';
  return html`<div
    class="st-sgrid flex flex-col gap-6 w-max bg-surface text-text-muted pt-4 px-6 pb-6"
    data-place="${place}"
    style="--st-cols: ${columns.length}; --st-cell-w: ${cellWidth}"
  >
    ${interactionGroup} ${restGroup}
  </div>`;
};

/** The head of a frame: its name and optional width, set above the frame box. */
export const canvasFrameHead = (name: string, width = '') =>
  html`<figcaption class="st-cframe-head absolute bottom-full left-0 flex pb-space-2 text-text whitespace-nowrap">
    ${name}${width ? `<span class="text-text-muted tabular-nums">${width}</span>` : ''}
  </figcaption>`;

/** The box of a frame: a hairline-edged surface around the body, with an optional head above it. */
export const canvasFrameBox = (body: string, head = '') =>
  html`<figure class="st-cframe relative m-0 bg-surface">${head}${body}</figure>`;

/** One frame on the canvas: the head above the box, the body inside. */
export const canvasFrame = (name: string, body: string, width = '') =>
  canvasFrameBox(body, canvasFrameHead(name, width));

const chipButton = (label: string, extra = '') =>
  button.render({ label, variant: 'transparent', color: 'surface', size: 'sm', class: extra || undefined });

const [zoomOut, zoomValue, zoomIn, zoomFit] = await Promise.all([
  chipButton('−'),
  chipButton('ZOOM', 'tabular-nums'),
  chipButton('+'),
  chipButton('Fit'),
]);

/**
 * The app's zoom chip in the canvas corner: zoom out, the zoom in percent (resets to 100 %), zoom in, fit.
 * The root has `data-canvas-zoom`; each button sits in a `data-camera-out`, `-reset`, `-in` or `-fit` wrapper for a setup to wire.
 */
export const canvasZoomChip = (percent: number, extra = '') =>
  html`<div
    class="absolute right-space-3 bottom-space-3 flex rounded-control-md border border-surface-border bg-surface${
      extra ? ` ${extra}` : ''
    }"
    data-canvas-zoom
  >
    <span class="contents" data-camera-out>${zoomOut.body}</span>
    <span class="contents" data-camera-reset>${zoomValue.body.replace('ZOOM', `${percent} %`)}</span>
    <span class="contents" data-camera-in>${zoomIn.body}</span>
    <span class="contents" data-camera-fit>${zoomFit.body}</span>
  </div>`;

/** The canvas: the frames from the top left at the given zoom, and the app's zoom chip in the corner. */
export const canvasView = (frames: string[], zoom: string) =>
  html`<div class="st-canvas relative h-full min-h-120 overflow-hidden">
    <div class="flex flex-col items-start gap-30 px-10 py-12" style="zoom: ${zoom}">${frames.join('')}</div>
    ${canvasZoomChip(parseFloat(zoom))}
  </div>`;

type Props = { part: string; states: string[]; zoom: string };

const buttonStates = {
  filled: { label: 'Save', variant: 'filled' },
  outline: { label: 'Save', variant: 'outline' },
  tonal: { label: 'Save', variant: 'tonal' },
} as const;

const interactions = ['rest', 'hover', 'active', 'focus-visible', 'pressed', 'disabled'] as const;

const forcedOf = (interaction: (typeof interactions)[number]) =>
  interaction === 'rest' || interaction === 'pressed' ? {} : { interaction };

const defaultFrames: Props = {
  part: 'button',
  states: ['filled', 'outline', 'tonal'],
  zoom: '100%',
};

export default definePart({
  note: 'The frames of one part on the canvas, in the state grid look: a sunken frame body, the cells as one component sheet with hairline dividers, labels outside the sheet. The element also exports that look (stateGrid, canvasFrameHead, canvasFrameBox, canvasFrame, canvasZoomChip, canvasView, canvasFrameStyles) for pages that draw their own frames. It fills its container and leaves room for a side panel through --st-shell-inset-left.',
  madeBy: ['claude-opus-5-5', 'claude-sonnet-5-5'],
  widths: [1440],
  states: {
    default: defaultFrames,
  },
  render: async ({ part, states, zoom }: Props) => {
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
      body: canvasView([canvasFrame(part, grid)], zoom),
      styles: canvasFrameStyles,
    });
  },
});
