import { formField } from '@ethlete/components/design/form-field';
import { select } from '@ethlete/components/design/select';
import { embedPage, html } from '@design-system';
import partTree from '@system/elements/part-tree';

export type FlowProps = { flow: 'open' | 'none' };

export type Step = { page: `pages/${string}`; state: string; title: string; via?: string };

export const FLOW_NAME = 'Sketch prüfen';

export const STEPS: Step[] = [
  { page: 'pages/inbox', state: 'open', title: 'Inbox · open' },
  {
    page: 'pages/sketches',
    state: 'page-sketch',
    title: 'Sketches · page-sketch',
    via: "Nutzer klickt 'Sketches' in der Leiste",
  },
  { page: 'pages/system', state: 'part', title: 'System · part', via: "Nutzer klickt 'Merge'" },
];

export const OTHER_FLOWS = ['Kommentar beantworten', 'Produkt anlegen'];

export const shot = (step: Step, scale: number) =>
  embedPage(step.page, { state: step.state, width: 1440, height: 900, scale }).body;

export const flowList = async () =>
  partTree.render({
    layers: [
      {
        title: 'Flows',
        open: true,
        parts: [{ name: FLOW_NAME, leaf: true, selected: true }, ...OTHER_FLOWS.map((name) => ({ name, leaf: true }))],
      },
    ],
  });

export const stepTree = async () =>
  partTree.render({
    layers: [
      {
        title: 'Flows',
        open: true,
        parts: [
          {
            name: FLOW_NAME,
            states: STEPS.map((step, index) => ({ name: `${index + 1} ${step.title}`, selected: index === 1 })),
          },
          ...OTHER_FLOWS.map((name) => ({ name })),
        ],
      },
    ],
  });

export const presetPicker = () =>
  formField({
    id: 'flow-preset',
    size: 'sm',
    control: select({ options: [{ value: 'desktop', label: 'Desktop · 1440 × 900' }], value: 'desktop' }),
  });

const ARROW = {
  right:
    '<svg class="block w-full h-3 text-text-muted" viewBox="0 0 100 12" preserveAspectRatio="none" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M0 6h96" vector-effect="non-scaling-stroke"/><path d="m90 1 6 5-6 5" vector-effect="non-scaling-stroke"/></svg>',
  down: '<svg class="block w-3 h-10 text-text-muted" viewBox="0 0 12 40" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M6 0v36"/><path d="m1 30 5 6 5-6"/></svg>',
};

export const arrow = (direction: 'right' | 'down') => ARROW[direction];

export const caption = (text: string) => html`<span class="text-text-muted text-ui-sm">${text}</span>`;

export const emptyCanvas = html`<div
  class="h-full flex flex-col items-center justify-center gap-space-2 ps-(--st-shell-inset-left)"
>
  <p class="text-text text-ui-sm">Keine Flows in diesem Produkt</p>
  <p class="text-text-muted text-ui-sm">Ein Agent legt Flows unter studio/flows/&lt;name&gt;.json an.</p>
</div>`;

export const emptySide = html`<p class="px-space-3 py-space-2 text-text-muted text-ui-sm">Noch keine Flows.</p>`;

const dot = '<span class="st-tree-lead"><span class="st-tree-dot"></span></span>';

export const flatFlowList = async () => {
  const tree = await partTree.render({ layers: [] });
  const rows = [FLOW_NAME, ...OTHER_FLOWS]
    .map(
      (name) =>
        `<div class="st-tree-row"${name === FLOW_NAME ? ' data-selected' : ''}>${dot}<span class="st-tree-label">${name}</span></div>`,
    )
    .join('');

  return { body: `<div class="st-tree">${rows}</div>`, styles: tree.styles };
};

export const pageHeader = (title: string, end = '') =>
  html`<header class="flex flex-none items-center gap-space-3 h-(--control-md)">
    <span class="text-ui-lg font-ui-strong">${title}</span>
    <span class="flex-1"></span>
    ${end}
  </header>`;

export const pagePadding = 'p-space-5 ps-[calc(var(--st-shell-inset-left)+var(--space-5))]';

type Node = { id: string; step: Step; col: number; row: number };

const NODES: Node[] = [
  { id: 'inbox', step: { page: 'pages/inbox', state: 'open', title: 'Inbox · open' }, col: 0, row: 0 },
  {
    id: 'sketch',
    step: { page: 'pages/sketches', state: 'page-sketch', title: 'Sketches · page-sketch' },
    col: 1,
    row: 0,
  },
  {
    id: 'resolved',
    step: { page: 'pages/inbox', state: 'with-resolved', title: 'Inbox · with-resolved' },
    col: 1,
    row: 1,
  },
  { id: 'system', step: { page: 'pages/system', state: 'part', title: 'System · part' }, col: 2, row: 0 },
];

const EDGES = [
  { from: 'inbox', to: 'sketch', label: "Nutzer klickt 'Sketches' in der Leiste" },
  { from: 'inbox', to: 'resolved', label: "Nutzer klickt 'Erledigte zeigen'" },
  { from: 'sketch', to: 'system', label: "Nutzer klickt 'Merge'" },
];

const CAPTION = 20;

export const flowGraph = (scale: number, colGap: number, rowGap = 56) => {
  const w = 1440 * scale;
  const h = 900 * scale;
  const at = (node: Node) => ({ x: node.col * (w + colGap), y: node.row * (h + CAPTION + rowGap) });
  const byId = new Map(NODES.map((node) => [node.id, node]));
  const cols = Math.max(...NODES.map((node) => node.col)) + 1;
  const rows = Math.max(...NODES.map((node) => node.row)) + 1;
  const width = cols * w + (cols - 1) * colGap;
  const height = rows * (h + CAPTION) + (rows - 1) * rowGap;

  const frames = NODES.map((node) => {
    const { x, y } = at(node);
    return `<figure class="absolute m-0 flex flex-col gap-space-1" style="left:${x}px;top:${y}px">${caption(node.step.title)}<div class="rounded-sm outline outline-surface-border">${shot(node.step, scale)}</div></figure>`;
  }).join('');

  const edges = EDGES.flatMap((edge) => {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (!from || !to) return [];
    const a = at(from);
    const b = at(to);
    const x1 = a.x + w + 4;
    const y1 = a.y + CAPTION + h / 2;
    const x2 = b.x - 4;
    const y2 = b.y + CAPTION + h / 2;
    const bend = x1 + 12;
    const path = y1 === y2 ? `M${x1} ${y1}H${x2}` : `M${x1} ${y1}H${bend}V${y2}H${x2}`;
    const label = `<span class="absolute text-center text-text-muted text-ui-xs -translate-y-full pb-space-1" style="left:${bend + 4}px;top:${y2}px;width:${x2 - bend - 8}px">${edge.label}</span>`;
    return [{ path, label }];
  });

  const svg = `<svg class="absolute inset-0 overflow-visible text-text-muted" width="${width}" height="${height}" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><defs><marker id="flow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1 9 5 1 9" fill="none" stroke="currentColor" stroke-width="1.5"/></marker></defs>${edges.map((edge) => `<path d="${edge.path}" marker-end="url(#flow-arrow)"/>`).join('')}</svg>`;

  return html`<div class="relative flex-none" style="width:${width}px;height:${height}px">
    ${svg}${frames}${edges.map((edge) => edge.label).join('')}
  </div>`;
};
