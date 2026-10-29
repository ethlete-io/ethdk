import { definePart, drawing, html } from '@design-system';
import button from '@system/components/button';
import styles from './canvas-frames.css?inline';

export type GridRow = { label: string; cells: (string | undefined)[] };
export type StateGridDrawing = { columns: string[]; rows: GridRow[] };
export type StateGridOptions = { cellWidth?: string; place?: 'fill' | 'center' };

/** The CSS for `stateGrid`, `canvasFrame` and `canvasView`; add it once to the drawing's styles. */
export const canvasFrameStyles = styles;

const perLine = 4;

const restOnly = (row: GridRow) => row.cells.every((cell, index) => index === 0 || cell === undefined);

const label = (text: string) => `<span class="st-sgrid-label">${text}</span>`;
const cell = (body: string | undefined) => `<div class="st-sgrid-cell">${body ?? ''}</div>`;

const tableRow = ({ label: text, cells }: GridRow) =>
  `<span class="st-sgrid-row">${text}</span>` + cells.map(cell).join('');

const packedLine = (rows: GridRow[]) => {
  const blanks = '<span></span>'.repeat(perLine - rows.length);
  return (
    '<span></span>' +
    rows.map((row) => label(row.label)).join('') +
    blanks +
    '<span></span>' +
    rows.map((row) => cell(row.cells[0])).join('') +
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
    ? `<div class="st-sgrid-group">
        <span class="st-sgrid-head">States by interaction</span>
        <span></span>
        ${columns.map(label).join('')} ${interactive.map(tableRow).join('')}
      </div>`
    : '';
  const restGroup = rest.length
    ? `<div class="st-sgrid-group st-sgrid-packed">
        <span class="st-sgrid-head">Rest only</span>
        ${lines(rest).map(packedLine).join('')}
      </div>`
    : '';
  return html`<div
    class="st-sgrid"
    data-place="${place}"
    style="--st-cols: ${columns.length}; --st-cell-w: ${cellWidth}"
  >
    ${interactionGroup} ${restGroup}
  </div>`;
};

/** One frame on the canvas: its name and optional width above the box, the body inside. */
export const canvasFrame = (name: string, body: string, width = '') =>
  html`<figure class="st-cframe">
    <figcaption class="st-cframe-head">
      ${name}${width ? `<span class="st-cframe-head-width">${width}</span>` : ''}
    </figcaption>
    ${body}
  </figure>`;

/** The canvas: the frames from the top left at the given zoom, and the zoom chip in the corner. */
export const canvasView = (frames: string[], zoom: string) =>
  html`<div class="st-canvas">
    <div class="st-canvas-frames" style="zoom: ${zoom}">${frames.join('')}</div>
    <div class="st-canvas-zoom"><span>Fit</span><span class="st-canvas-zoom-value">${zoom}</span></div>
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
  note: 'The frames of one part on the canvas, in the state grid look: a sunken frame body, the cells as one component sheet with hairline dividers, labels outside the sheet. The element also exports that look (stateGrid, canvasFrame, canvasView, canvasFrameStyles) for pages that draw their own frames. It fills its container and leaves room for a side panel through --st-shell-inset-left.',
  madeBy: ['claude-opus-5-5'],
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
      styles: (rows[0]?.cells[0]?.styles ?? '') + styles,
    });
  },
});
