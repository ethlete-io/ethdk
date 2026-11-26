import { css, html } from '@design-explore';

/** One flow in every frame: four sources, two pools, four uses; ten nodes and twelve links. */
type Node = { key: string; name: string; column: number };
type Link = { source: string; target: string; value: number };

const NODES: Node[] = [
  { key: 'tickets', name: 'Tickets', column: 0 },
  { key: 'sponsors', name: 'Sponsors', column: 0 },
  { key: 'merch', name: 'Merch', column: 0 },
  { key: 'grants', name: 'Grants', column: 0 },
  { key: 'budget', name: 'Budget', column: 1 },
  { key: 'reserve', name: 'Reserve', column: 1 },
  { key: 'travel', name: 'Travel', column: 2 },
  { key: 'venue', name: 'Venue', column: 2 },
  { key: 'staff', name: 'Staff', column: 2 },
  { key: 'marketing', name: 'Marketing', column: 2 },
];

const LINKS: Link[] = [
  { source: 'tickets', target: 'budget', value: 300 },
  { source: 'sponsors', target: 'budget', value: 500 },
  { source: 'sponsors', target: 'reserve', value: 200 },
  { source: 'merch', target: 'budget', value: 150 },
  { source: 'grants', target: 'budget', value: 250 },
  { source: 'grants', target: 'reserve', value: 150 },
  { source: 'budget', target: 'travel', value: 300 },
  { source: 'budget', target: 'venue', value: 400 },
  { source: 'budget', target: 'staff', value: 350 },
  { source: 'budget', target: 'marketing', value: 150 },
  { source: 'reserve', target: 'staff', value: 200 },
  { source: 'reserve', target: 'marketing', value: 150 },
];

export const nodeKeys = NODES.map((node) => node.key);
export const linkKey = (source: string, target: string) => `${source}>${target}`;
export const linkKeys = LINKS.map((link) => linkKey(link.source, link.target));
export const nodeName = (key: string) => NODES.find((node) => node.key === key)?.name ?? key;
export const linkName = (key: string) => {
  const [source, target] = key.split('>');
  return `${nodeName(source ?? '')} → ${nodeName(target ?? '')}`;
};
export const linkValue = (key: string) => LINKS.find((link) => linkKey(link.source, link.target) === key)?.value ?? 0;

/** The link every frame's trail walks to. */
export const GOAL = linkKey('reserve', 'staff');

export const SURFACE = '#ffffff';
export const INK = '#1c1f24';
export const MUTED = '#5f6670';
export const BORDER = '#e3e5e8';
export const ACCENT = '#2f6fdf';

export const FRAME_WIDTH = 560;
const FRAME_PADDING = 16;
const PLOT_WIDTH = FRAME_WIDTH - FRAME_PADDING * 2;
const PLOT_HEIGHT = 260;
const NODE_WIDTH = 10;
const NODE_GAP = 12;

const nodeValue = (key: string) =>
  Math.max(
    LINKS.filter((link) => link.target === key).reduce((sum, link) => sum + link.value, 0),
    LINKS.filter((link) => link.source === key).reduce((sum, link) => sum + link.value, 0),
  );

const columns = [0, 1, 2].map((column) => NODES.filter((node) => node.column === column));
const scale = Math.min(
  ...columns.map(
    (members) =>
      (PLOT_HEIGHT - NODE_GAP * (members.length - 1)) / members.reduce((sum, node) => sum + nodeValue(node.key), 0),
  ),
);

type Box = { x: number; y: number; height: number };
const boxes: Record<string, Box> = {};
columns.forEach((members, column) => {
  const total = members.reduce((sum, node) => sum + nodeValue(node.key) * scale, 0) + NODE_GAP * (members.length - 1);
  let y = (PLOT_HEIGHT - total) / 2;
  const x = (column * (PLOT_WIDTH - NODE_WIDTH)) / 2;
  for (const node of members) {
    const height = nodeValue(node.key) * scale;
    boxes[node.key] = { x, y, height };
    y += height + NODE_GAP;
  }
});

type Ribbon = { key: string; path: string; midX: number; midY: number };
const sourceOffset: Record<string, number> = {};
const targetOffset: Record<string, number> = {};
const ribbons: Ribbon[] = LINKS.map((link) => {
  const source = boxes[link.source] as Box;
  const target = boxes[link.target] as Box;
  const width = link.value * scale;
  const y0 = source.y + (sourceOffset[link.source] ?? 0);
  const y1 = target.y + (targetOffset[link.target] ?? 0);
  sourceOffset[link.source] = (sourceOffset[link.source] ?? 0) + width;
  targetOffset[link.target] = (targetOffset[link.target] ?? 0) + width;
  const x0 = source.x + NODE_WIDTH;
  const x1 = target.x;
  const xm = (x0 + x1) / 2;

  return {
    key: linkKey(link.source, link.target),
    path: `M${x0},${y0}C${xm},${y0} ${xm},${y1} ${x1},${y1}V${y1 + width}C${xm},${y1 + width} ${xm},${y0 + width} ${x0},${y0 + width}Z`,
    midX: xm,
    midY: (y0 + y1 + width) / 2,
  };
});

const markCenter = (key: string) => {
  const box = boxes[key];
  if (box) return { x: box.x + NODE_WIDTH / 2, y: box.y + box.height / 2 };
  const ribbon = ribbons.find((candidate) => candidate.key === key);
  return { x: ribbon?.midX ?? 0, y: ribbon?.midY ?? 0 };
};

export type Badge = { mark: string; label: string };

export type ChartState = {
  /** The node or link key that holds focus. */
  focus: string;
  /** Numbered markers on the marks the trail visited. */
  badges?: Badge[];
  /** Marks that can take focus with Tab; drawn with a dashed outline. */
  tabStops?: string[];
  /** Whether the whole chart is the single tab stop. */
  chartStop?: boolean;
  /** Tooltip body shown next to the focused mark. */
  tooltip?: string;
};

const isNode = (key: string) => key in boxes;

export const chart = ({ focus, badges = [], tabStops = [], chartStop = false, tooltip }: ChartState) => {
  const activeNode = isNode(focus) ? focus : null;
  const highlighted = (key: string) =>
    activeNode ? key.startsWith(`${activeNode}>`) || key.endsWith(`>${activeNode}`) : key === focus;
  const center = markCenter(focus);

  return html`
    <div class="chart ${chartStop ? 'chart--stop' : ''}">
      <svg class="sankey" width="${PLOT_WIDTH}" height="${PLOT_HEIGHT}" data-highlight>
        <g>
          ${ribbons.map(
            (ribbon) =>
              html`<path
                class="ribbon ${highlighted(ribbon.key) ? 'ribbon--on' : ''} ${
                  ribbon.key === focus ? 'ribbon--focus' : ''
                } ${tabStops.includes(ribbon.key) ? 'ribbon--stop' : ''}"
                d="${ribbon.path}"
              />`,
          )}
        </g>
        <g>
          ${NODES.map((node) => {
            const box = boxes[node.key] as Box;
            return html`
              <rect
                class="node-target ${node.key === focus ? 'node-target--focus' : ''} ${
                  tabStops.includes(node.key) ? 'node-target--stop' : ''
                }"
                x="${box.x - 4}"
                y="${box.y - 4}"
                width="${NODE_WIDTH + 8}"
                height="${box.height + 8}"
                rx="3"
              />
              <rect class="node" x="${box.x}" y="${box.y}" width="${NODE_WIDTH}" height="${box.height}" />
            `;
          })}
        </g>
        <g>
          ${badges.map(({ mark, label }) => {
            const { x, y } = markCenter(mark);
            const width = Math.max(14, label.length * 6 + 6);
            return html`<g class="badge">
              <rect x="${x - width / 2}" y="${y - 7}" width="${width}" height="14" rx="7" />
              <text x="${x}" y="${y + 3.5}">${label}</text>
            </g>`;
          })}
        </g>
      </svg>
      <div class="labels">
        ${NODES.map((node) => {
          const box = boxes[node.key] as Box;
          const left = node.column === 2;
          return html`<span
            class="label"
            style="top: ${box.y + box.height / 2}px; ${
              left ? `right: ${PLOT_WIDTH - box.x + 6}px` : `left: ${box.x + NODE_WIDTH + 6}px`
            }"
            >${node.name}</span
          >`;
        })}
      </div>
      ${
        tooltip &&
        html`<div
          class="tooltip"
          style="${center.x > PLOT_WIDTH / 2 ? `right: ${PLOT_WIDTH - center.x + 14}px` : `left: ${center.x + 14}px`}; top: ${Math.max(0, center.y - 24)}px"
        >
          ${tooltip}
        </div>`
      }
    </div>
  `;
};

export type Step = { keys: string; lands: string; index?: string };

/** The key legend under the chart: the presses that reach {@link GOAL}, and what Tab-past costs. */
export const trail = (steps: Step[], summary: string) => html`
  <div class="trail">
    <p class="trail-goal">Goal: read <strong>${linkName(GOAL)}</strong> (${linkValue(GOAL)})</p>
    <ol class="trail-steps">
      ${steps.map(
        (step, index) =>
          html`<li>
            <span class="trail-index">${step.index ?? index + 1}</span>
            <span class="trail-keys"
              >${step.keys
                .split(' ')
                .filter(Boolean)
                .map((key) => html`<kbd>${key}</kbd>`)}</span
            >
            <span class="trail-lands">${step.lands}</span>
          </li>`,
      )}
    </ol>
    <p class="trail-summary">${summary}</p>
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
    color: ${MUTED};
  }

  .chart {
    position: relative;
    inline-size: ${PLOT_WIDTH}px;
    block-size: ${PLOT_HEIGHT}px;
    border-radius: 6px;
  }

  .chart--stop {
    outline: 2px solid ${ACCENT};
    outline-offset: 6px;
  }

  .sankey {
    display: block;
    overflow: visible;
  }

  .ribbon {
    fill: ${ACCENT};
    fill-opacity: 0.12;
    stroke: transparent;
  }

  .ribbon--on {
    fill-opacity: 0.4;
  }

  .ribbon--stop {
    stroke: ${MUTED};
    stroke-width: 0.75px;
    stroke-dasharray: 2 2;
  }

  .ribbon--focus {
    fill-opacity: 0.5;
    stroke: ${ACCENT};
    stroke-width: 2px;
    stroke-dasharray: none;
  }

  .node {
    fill: ${ACCENT};
  }

  .node-target {
    fill: transparent;
    stroke: transparent;
    stroke-width: 2px;
  }

  .node-target--stop {
    stroke: ${MUTED};
    stroke-width: 0.75px;
    stroke-dasharray: 2 2;
  }

  .node-target--focus {
    fill: color-mix(in srgb, ${ACCENT} 8%, transparent);
    stroke: ${ACCENT};
    stroke-width: 2px;
    stroke-dasharray: none;
  }

  .badge rect {
    fill: ${INK};
  }

  .badge text {
    fill: ${SURFACE};
    font-size: 9px;
    font-weight: 600;
    text-anchor: middle;
    font-variant-numeric: tabular-nums;
  }

  .labels {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .label {
    position: absolute;
    translate: 0 -50%;
    color: ${INK};
    white-space: nowrap;
  }

  .tooltip {
    position: absolute;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px 8px;
    border: 1px solid ${BORDER};
    border-radius: 6px;
    background: ${SURFACE};
    box-shadow: 0 2px 8px rgb(0 0 0 / 12%);
    color: ${INK};
    white-space: nowrap;
  }

  .tooltip strong {
    font-weight: 600;
  }

  .tooltip .muted {
    color: ${MUTED};
  }

  .trail {
    margin-top: 16px;
    padding-top: 10px;
    border-top: 1px solid ${BORDER};
  }

  .trail-goal,
  .trail-summary {
    margin: 0;
  }

  .trail-goal strong {
    color: ${INK};
  }

  .trail-steps {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px 16px;
    margin: 8px 0;
    padding: 0;
    list-style: none;
  }

  .trail-steps li {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .trail-index {
    display: inline-grid;
    place-items: center;
    min-inline-size: 16px;
    block-size: 16px;
    padding-inline: 3px;
    white-space: nowrap;
    box-sizing: border-box;
    border-radius: 8px;
    background: ${INK};
    color: ${SURFACE};
    font-size: 9px;
    font-weight: 600;
  }

  .trail-keys {
    display: inline-flex;
    gap: 3px;
  }

  kbd {
    padding: 0 5px;
    border: 1px solid ${BORDER};
    border-bottom-width: 2px;
    border-radius: 4px;
    font-family: ui-monospace, monospace;
    font-size: 11px;
    color: ${INK};
  }

  .trail-lands {
    color: ${INK};
  }

  .trail-summary {
    color: ${INK};
    font-weight: 600;
  }
`;
