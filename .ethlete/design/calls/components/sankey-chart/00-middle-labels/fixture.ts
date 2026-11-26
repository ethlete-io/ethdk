import { css, html } from '@design-explore';

/** A four-column signup funnel, laid out the way the shipped sankey does at its defaults. */
type NodeInput = { id: string; name: string; column: number };
type LinkInput = { source: string; target: string; value: number };

const NODE_INPUTS: NodeInput[] = [
  { id: 'organic', name: 'Organic search', column: 0 },
  { id: 'paid', name: 'Paid ads', column: 0 },
  { id: 'referral', name: 'Referral', column: 0 },
  { id: 'landing', name: 'Visited the landing page', column: 1 },
  { id: 'pricing', name: 'Compared the pricing plans', column: 1 },
  { id: 'started', name: 'Started the signup form', column: 2 },
  { id: 'bounced', name: 'Bounced before signing up', column: 2 },
  { id: 'verified', name: 'Verified account', column: 3 },
  { id: 'abandoned', name: 'Abandoned at email step', column: 3 },
];

const LINK_INPUTS: LinkInput[] = [
  { source: 'organic', target: 'landing', value: 300 },
  { source: 'organic', target: 'pricing', value: 120 },
  { source: 'paid', target: 'landing', value: 240 },
  { source: 'paid', target: 'pricing', value: 60 },
  { source: 'referral', target: 'landing', value: 80 },
  { source: 'referral', target: 'pricing', value: 100 },
  { source: 'landing', target: 'started', value: 300 },
  { source: 'landing', target: 'bounced', value: 320 },
  { source: 'pricing', target: 'started', value: 180 },
  { source: 'pricing', target: 'bounced', value: 100 },
  { source: 'started', target: 'verified', value: 330 },
  { source: 'started', target: 'abandoned', value: 150 },
];

export const SURFACE = '#ffffff';
export const INK = '#1c1f24';
export const MUTED = '#5f6670';
export const BORDER = '#e3e5e8';
export const ACCENT = '#2f6fdf';

export const FRAME_WIDTH = 720;
export const FRAME_PADDING = 16;
export const PLOT_WIDTH = FRAME_WIDTH - FRAME_PADDING * 2;
export const PLOT_HEIGHT = 320;
export const NODE_WIDTH = 12;
export const NODE_GAP = 12;
export const LABEL_WIDTH = 120;
export const LABEL_PADDING = 6;
const LINK_OPACITY = 0.35;

const COLUMN_COUNT = 4;
export const COLUMN_STEP = (PLOT_WIDTH - 2 * LABEL_WIDTH - NODE_WIDTH) / (COLUMN_COUNT - 1);

export type SankeyNode = NodeInput & {
  value: number;
  incoming: number;
  outgoing: number;
  x: number;
  y: number;
  height: number;
  middle: boolean;
};

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const incomingOf = (id: string) => sum(LINK_INPUTS.filter((link) => link.target === id).map((link) => link.value));
const outgoingOf = (id: string) => sum(LINK_INPUTS.filter((link) => link.source === id).map((link) => link.value));

const columns = Array.from({ length: COLUMN_COUNT }, (_, column) =>
  NODE_INPUTS.filter((node) => node.column === column).map((node) => ({
    ...node,
    incoming: incomingOf(node.id),
    outgoing: outgoingOf(node.id),
    value: Math.max(incomingOf(node.id), outgoingOf(node.id)),
  })),
);

const scale = Math.min(
  ...columns.map((column) => (PLOT_HEIGHT - (column.length - 1) * NODE_GAP) / sum(column.map((node) => node.value))),
);

export const NODES: SankeyNode[] = columns.flatMap((column) => {
  const total = sum(column.map((node) => node.value * scale)) + (column.length - 1) * NODE_GAP;
  let y = (PLOT_HEIGHT - total) / 2;

  return column.map((node) => {
    const height = node.value * scale;
    const placed = {
      ...node,
      x: LABEL_WIDTH + node.column * COLUMN_STEP,
      y,
      height,
      middle: node.column > 0 && node.column < COLUMN_COUNT - 1,
    };
    y += height + NODE_GAP;
    return placed;
  });
});

const nodeById = new Map(NODES.map((node) => [node.id, node]));
const nodeOf = (id: string) => nodeById.get(id) as SankeyNode;

const linkPaths = () => {
  const sourceOffset = new Map<string, number>();
  const targetOffset = new Map<string, number>();
  const bySourceThenTarget = [...LINK_INPUTS].sort(
    (a, b) => nodeOf(a.source).y - nodeOf(b.source).y || nodeOf(a.target).y - nodeOf(b.target).y,
  );
  const sourceY = new Map<LinkInput, number>();

  for (const link of bySourceThenTarget) {
    const offset = sourceOffset.get(link.source) ?? 0;
    sourceY.set(link, nodeOf(link.source).y + offset);
    sourceOffset.set(link.source, offset + link.value * scale);
  }

  return [...LINK_INPUTS]
    .sort((a, b) => nodeOf(a.target).y - nodeOf(b.target).y || nodeOf(a.source).y - nodeOf(b.source).y)
    .map((link) => {
      const width = link.value * scale;
      const offset = targetOffset.get(link.target) ?? 0;
      targetOffset.set(link.target, offset + width);
      const sy = sourceY.get(link) ?? 0;
      const ty = nodeOf(link.target).y + offset;
      const x0 = nodeOf(link.source).x + NODE_WIDTH;
      const x1 = nodeOf(link.target).x;
      const xm = (x0 + x1) / 2;

      return `M${x0},${sy}C${xm},${sy} ${xm},${ty} ${x1},${ty}L${x1},${ty + width}C${xm},${ty + width} ${xm},${sy + width} ${x0},${sy + width}Z`;
    });
};

/** The shipped marks: accent nodes, and ribbons at the shipped link opacity. */
export const plot = () => html`
  <svg class="plot-svg" width="${PLOT_WIDTH}" height="${PLOT_HEIGHT}">
    <g>
      ${NODES.map(
        (node) => html`<rect class="node" x="${node.x}" y="${node.y}" width="${NODE_WIDTH}" height="${node.height}" />`,
      )}
    </g>
    <g>${linkPaths().map((path) => html`<path class="link" d="${path}" />`)}</g>
  </svg>
`;

/** Room a label after its node gets: the next column for a middle node, the inset for the last column. */
export const endLabelMaxWidth = (node: SankeyNode) =>
  (node.middle ? COLUMN_STEP - NODE_WIDTH : LABEL_WIDTH) - 2 * LABEL_PADDING;

/** The shipped label of a first- or last-column node. */
export const outerLabel = (node: SankeyNode) =>
  node.column === 0
    ? html`<span
        class="label"
        data-side="start"
        style="left: ${node.x - LABEL_PADDING}px; top: ${node.y + node.height / 2}px; max-width: ${LABEL_WIDTH - 2 * LABEL_PADDING}px"
        >${node.name}</span
      >`
    : html`<span
        class="label"
        style="left: ${node.x + NODE_WIDTH + LABEL_PADDING}px; top: ${node.y + node.height / 2}px; max-width: ${endLabelMaxWidth(node)}px"
        >${node.name}</span
      >`;

/** The plot with its labels: outer columns as shipped, every middle node through `middleLabel`. */
export const chart = (middleLabel: (node: SankeyNode) => string, extra = '') => html`
  <div class="plot">
    ${plot()}
    <div class="labels">${NODES.map((node) => (node.middle ? middleLabel(node) : outerLabel(node)))}</div>
    ${extra}
  </div>
`;

export const frameStyles = css`
  html {
    background: ${SURFACE};
  }

  #root {
    display: block;
    padding: ${FRAME_PADDING}px;
    background: ${SURFACE};
    font-family: system-ui, sans-serif;
    font-size: 12px;
    line-height: 1.4;
    color: ${INK};
  }

  .plot {
    position: relative;
    inline-size: ${PLOT_WIDTH}px;
    block-size: ${PLOT_HEIGHT}px;
    margin-block: 0.7em;
  }

  .plot-svg {
    display: block;
    overflow: visible;
  }

  .node {
    fill: ${ACCENT};
  }

  .link {
    fill: ${ACCENT};
    fill-opacity: ${LINK_OPACITY};
  }

  .labels {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .label {
    position: absolute;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    translate: 0 -50%;
    text-shadow:
      0 0 2px ${SURFACE},
      0 0 4px ${SURFACE};
  }

  .label[data-side='start'] {
    translate: -100% -50%;
    text-align: end;
  }
`;
