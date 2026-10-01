import { css, html } from '@design-explore';

/** A signup funnel in four columns, drawn in a 360px phone frame by every variant. */
export const NODES = [
  { id: 'search', label: 'Search', column: 0 },
  { id: 'social', label: 'Social', column: 0 },
  { id: 'referral', label: 'Referral', column: 0 },
  { id: 'landing', label: 'Landing page', column: 1 },
  { id: 'pricing', label: 'Pricing page', column: 1 },
  { id: 'signup', label: 'Signed up', column: 2 },
  { id: 'left', label: 'Left', column: 2 },
  { id: 'active', label: 'Activated', column: 3 },
  { id: 'dormant', label: 'Dormant', column: 3 },
];

export const LINKS = [
  { source: 'search', target: 'landing', value: 40 },
  { source: 'search', target: 'pricing', value: 20 },
  { source: 'social', target: 'landing', value: 25 },
  { source: 'social', target: 'pricing', value: 5 },
  { source: 'referral', target: 'pricing', value: 10 },
  { source: 'landing', target: 'signup', value: 30 },
  { source: 'landing', target: 'left', value: 35 },
  { source: 'pricing', target: 'signup', value: 25 },
  { source: 'pricing', target: 'left', value: 10 },
  { source: 'signup', target: 'active', value: 35 },
  { source: 'signup', target: 'dormant', value: 20 },
];

export const SURFACE = '#ffffff';
export const INK = '#1c1f24';
export const MUTED = '#5f6670';
export const BORDER = '#e3e5e8';
export const ACCENT = '#2f6fdf';

export const FRAME_WIDTH = 360;
export const FRAME_PADDING = 16;
export const CONTENT_WIDTH = FRAME_WIDTH - FRAME_PADDING * 2;

export const NODE_WIDTH = 12;
export const NODE_GAP = 12;
export const LABEL_PADDING = 6;
export const LINK_OPACITY = 0.35;

const COLUMN_COUNT = 4;

export interface SankeyOptions {
  /** Size along the flow: width for a horizontal flow, height for a vertical one. */
  length: number;
  /** Size across the flow. */
  breadth: number;
  insetStart: number;
  insetEnd: number;
  vertical?: boolean;
}

interface PlacedNode {
  id: string;
  label: string;
  column: number;
  along: number;
  across: number;
  size: number;
  value: number;
}

const nodeValue = (id: string) => {
  const incoming = LINKS.filter((link) => link.target === id).reduce((sum, link) => sum + link.value, 0);
  const outgoing = LINKS.filter((link) => link.source === id).reduce((sum, link) => sum + link.value, 0);
  return Math.max(incoming, outgoing);
};

const place = (options: SankeyOptions) => {
  const columns = Array.from({ length: COLUMN_COUNT }, (_, column) => NODES.filter((node) => node.column === column));
  const scale = Math.min(
    ...columns.map(
      (members) =>
        (options.breadth - NODE_GAP * (members.length - 1)) /
        members.reduce((sum, node) => sum + nodeValue(node.id), 0),
    ),
  );
  const step = (options.length - options.insetStart - options.insetEnd - NODE_WIDTH) / (COLUMN_COUNT - 1);
  const placed = new Map<string, PlacedNode>();

  columns.forEach((members, column) => {
    const total = members.reduce((sum, node) => sum + nodeValue(node.id), 0) * scale + NODE_GAP * (members.length - 1);
    let across = (options.breadth - total) / 2;

    for (const node of members) {
      const value = nodeValue(node.id);
      const size = value * scale;
      placed.set(node.id, { ...node, along: options.insetStart + column * step, across, size, value });
      across += size + NODE_GAP;
    }
  });

  return { placed, scale, step };
};

/** The node rects, link ribbons and label anchors for one orientation and size. */
export const sankey = (options: SankeyOptions) => {
  const { placed, scale, step } = place(options);
  const outOffset = new Map<string, number>();
  const inOffset = new Map<string, number>();

  const ribbons = LINKS.map((link) => {
    const source = placed.get(link.source) as PlacedNode;
    const target = placed.get(link.target) as PlacedNode;
    const size = link.value * scale;
    const s0 = source.across + (outOffset.get(link.source) ?? 0);
    const t0 = target.across + (inOffset.get(link.target) ?? 0);
    outOffset.set(link.source, (outOffset.get(link.source) ?? 0) + size);
    inOffset.set(link.target, (inOffset.get(link.target) ?? 0) + size);

    const a0 = source.along + NODE_WIDTH;
    const a1 = target.along;
    const mid = (a0 + a1) / 2;
    const point = (along: number, across: number) => (options.vertical ? `${across},${along}` : `${along},${across}`);

    return `M${point(a0, s0)}C${point(mid, s0)} ${point(mid, t0)} ${point(a1, t0)}L${point(a1, t0 + size)}C${point(mid, t0 + size)} ${point(mid, s0 + size)} ${point(a0, s0 + size)}Z`;
  });

  const nodes = [...placed.values()];

  return { nodes, ribbons, step };
};

/** The SVG marks of a layout: ribbons under nodes. */
export const marks = (layout: ReturnType<typeof sankey>, vertical = false) => html`
  <g>${layout.ribbons.map((d) => html`<path class="link" d="${d}" />`)}</g>
  <g>
    ${layout.nodes.map((node) =>
      vertical
        ? html`<rect class="node" x="${node.across}" y="${node.along}" width="${node.size}" height="${NODE_WIDTH}" />`
        : html`<rect class="node" x="${node.along}" y="${node.across}" width="${NODE_WIDTH}" height="${node.size}" />`,
    )}
  </g>
`;

/** Shipped label placement: the first column to the start of its node, every other column to the end. */
export const horizontalLabels = (layout: ReturnType<typeof sankey>, labelWidth: number) =>
  layout.nodes.map((node) => {
    const start = node.column === 0;
    const room = start || node.column === COLUMN_COUNT - 1 ? labelWidth : layout.step - NODE_WIDTH;
    const x = start ? node.along - LABEL_PADDING : node.along + NODE_WIDTH + LABEL_PADDING;
    return html`<span
      class="label"
      data-side="${start ? 'start' : 'end'}"
      style="left: ${x}px; top: ${node.across + node.size / 2}px; max-width: ${room - LABEL_PADDING}px"
      >${node.label}</span
    >`;
  });

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

  .title {
    margin: 0 0 4px;
    font-size: 14px;
    font-weight: 600;
  }

  .subtitle {
    margin: 0 0 12px;
    color: ${MUTED};
  }

  .plot {
    position: relative;
  }

  .plot svg {
    display: block;
    overflow: visible;
  }

  .link {
    fill: ${ACCENT};
    fill-opacity: ${LINK_OPACITY};
  }

  .node {
    fill: ${ACCENT};
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

  .note {
    margin: 12px 0 0;
    padding-top: 8px;
    border-top: 1px dashed ${BORDER};
    color: ${MUTED};
    font-size: 11px;
  }
`;

export const header = html`
  <p class="title">Signup funnel</p>
  <p class="subtitle">100 visitors, last 30 days</p>
`;
