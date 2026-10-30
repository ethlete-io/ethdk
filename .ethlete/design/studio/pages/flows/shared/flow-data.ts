import { formField } from '@ethlete/components/design/form-field';
import { select } from '@ethlete/components/design/select';
import { embedPage, html } from '@design-system';
import button from '@system/components/button';
import treeRow from '@system/components/tree-row';

export type FlowProps = { flow: 'open' | 'none' };

type Step = { page: `pages/${string}`; state: string; title: string; via?: string };

export const FLOW_NAME = 'Sketch prüfen';

const OTHER_FLOWS = ['Kommentar beantworten', 'Produkt anlegen'];

const shot = (step: Step, scale: number) =>
  embedPage(step.page, { state: step.state, width: 1440, height: 900, scale }).body;

export const presetPicker = () =>
  formField({
    id: 'flow-preset',
    size: 'sm',
    control: select({ options: [{ value: 'desktop', label: 'Desktop · 1440 × 900' }], value: 'desktop' }),
  });

const caption = (text: string) => html`<span class="text-text-muted text-ui-sm">${text}</span>`;

const copy = await button.render({ label: 'Prompt kopieren', variant: 'outline', size: 'sm' });

export const emptyStyles = copy.styles;

const prompt = html`<p class="m-0 p-space-3 rounded-(--radius-control-md) bg-surface-sunken text-text text-ui-sm">
  Zeichne den Flow „Sketch prüfen“: von der Inbox über den Sketch bis zum gemergten Teil.
</p>`;
const ghostBox = '<span class="block w-24 h-15 rounded-sm outline outline-surface-border bg-surface"></span>';
const ghostLine = '<span class="block w-10 h-px bg-surface-border"></span>';

export const emptyCanvas = html`<div class="h-full flex items-center justify-center ps-(--st-shell-inset-left)">
  <div class="w-2xl flex flex-col items-center gap-space-4 text-center text-ui-sm">
    <div class="flex items-center gap-space-2" aria-hidden="true">
      ${ghostBox}${ghostLine}${ghostBox}${ghostLine}${ghostBox}
    </div>
    <p class="m-0 text-text font-ui-strong text-ui-md">Noch keine Flows</p>
    <p class="m-0 text-text-muted">
      Ein Flow verbindet Seiten und ihre Zustände zu einem Weg, den du von links nach rechts liest. Dein Agent legt ihn
      an. Bitte ihn zum Beispiel so:
    </p>
    ${prompt} ${copy.body}
  </div>
</div>`;

export const emptySide = html`<p class="px-space-3 py-space-2 text-text-muted text-ui-sm">Noch keine Flows.</p>`;

export const flatFlowList = () =>
  treeRow.render({
    rows: [FLOW_NAME, ...OTHER_FLOWS].map((label) => ({
      label,
      depth: 0,
      kind: 'leaf',
      selected: label === FLOW_NAME,
    })),
  });

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

  const svg = `<svg data-et-drawing class="absolute inset-0 overflow-visible text-text-muted" width="${width}" height="${height}" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><defs><marker id="flow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1 9 5 1 9" fill="none" stroke="currentColor" stroke-width="1.5"/></marker></defs>${edges.map((edge) => `<path d="${edge.path}" marker-end="url(#flow-arrow)"/>`).join('')}</svg>`;

  return html`<div class="relative flex-none" style="width:${width}px;height:${height}px">
    ${svg}${frames}${edges.map((edge) => edge.label).join('')}
  </div>`;
};
