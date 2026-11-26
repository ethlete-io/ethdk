import { embedPage, html, slot, withAction } from '@design-system';
import button from '@system/components/button';
import select from '@system/components/select';
import textarea from '@system/components/textarea';
import treeRow from '@system/components/tree-row';
import { icon } from '@system/foundations/icons';
import { FLOWS_LABELS } from '../../../../../../apps/ethlete-studio/src/app/i18n/flows-labels';
import { SYSTEM_LABELS } from '../../../../../../apps/ethlete-studio/src/app/i18n/system-labels';

export type FlowProps = {
  flow: 'open' | 'none';
  notes?: boolean;
  orphans?: boolean;
  commentMode?: boolean;
  comments?: boolean;
  thread?: boolean;
  draft?: string;
};

export type FlowNoteSample = { id: string; text: string; x: number; y: number };

export const FLOW_NOTES: FlowNoteSample[] = [
  { id: 'gap', text: 'Hier fehlt noch der Weg, wenn der Nutzer den Sketch verwirft.', x: 790, y: 262 },
  { id: 'new', text: '', x: 0, y: 262 },
];

export const ORPHAN_NOTES: FlowNoteSample[] = [
  { id: 'lost-1', text: 'Rückweg nach Verwerfen', x: 1420, y: 60 },
  { id: 'lost-2', text: 'Merge-Knopf klären', x: 1420, y: 300 },
];

export const ORPHAN_TITLE = FLOWS_LABELS.orphans;

export const orphanButtons = async () =>
  Promise.all(
    ORPHAN_NOTES.map(async (note) => {
      const entry = await button.render({ label: note.text, variant: 'transparent', color: 'surface', size: 'sm' });

      return { ...entry, body: withAction(entry.body, 'emit:jumpToNote') };
    }),
  );

export const commentToggleButton = async ({ on, action }: { on: boolean; action: string }) => {
  const toggle = await button.render({
    iconOnly: true,
    icon: icon('comment', { size: 16 }),
    ariaLabel: SYSTEM_LABELS.comment,
    variant: 'transparent',
    color: 'surface',
    size: 'sm',
    pressed: on,
  });

  return { ...toggle, body: withAction(toggle.body, action) };
};

export const addNoteButton = async () => {
  const add = await button.render({
    iconOnly: true,
    icon: icon('pencil', { size: 16 }),
    ariaLabel: FLOWS_LABELS.addNote,
    variant: 'transparent',
    color: 'surface',
    size: 'sm',
  });

  return { ...add, body: withAction(add.body, 'emit:addNote') };
};

export const noteDeleteButton = async () => {
  const remove = await button.render({
    iconOnly: true,
    icon: icon('close', { size: 14 }),
    ariaLabel: FLOWS_LABELS.deleteNote,
    variant: 'transparent',
    color: 'surface',
    size: 'xs',
  });

  return { ...remove, body: withAction(remove.body, 'emit:deleteNote') };
};

export const noteField = (id: string) =>
  textarea.render({
    field: {
      id: `flow-note-${id}`,
      placeholder: FLOWS_LABELS.notePlaceholder,
      rows: 3,
      ariaLabel: FLOWS_LABELS.addNote,
      focused: true,
      force: 'focus-visible',
    },
  });

type Step = { page: `pages/${string}`; state: string; title: string; via?: string };

export const FLOW_NAME = 'Sketch prüfen';

const OTHER_FLOWS = ['Kommentar beantworten', 'Produkt anlegen'];

const shot = (step: Step, scale: number) =>
  embedPage(step.page, { state: step.state, width: 1440, height: 900, scale }).body;

export const presetPickerOf = async () => {
  const picker = await select.render({
    label: '',
    ariaLabel: FLOWS_LABELS.presetAria,
    size: 'sm',
    value: 'desktop',
    options: [{ value: 'desktop', label: 'Desktop · 1440 × 900' }],
  });

  return { ...picker, body: withAction(picker.body, { action: 'emit:presetChange', on: '.et-select-trigger' }) };
};

const caption = (text: string) => html`<span class="text-et-surface-text-muted text-ui-sm">${text}</span>`;

export const copyButton = () => button.render({ label: FLOWS_LABELS.copyPrompt, variant: 'outline', size: 'sm' });

const prompt = html`<p
  class="m-0 p-space-3 rounded-(--radius-control-md) bg-et-surface-background text-et-surface-text text-ui-sm"
>
  ${FLOWS_LABELS.emptyPrompt}
</p>`;
const ghostBox =
  '<span class="block w-24 h-15 rounded-sm outline outline-et-surface-border bg-et-surface-background"></span>';
const ghostLine = '<span class="block w-10 h-px bg-et-surface-border"></span>';

export const emptyCanvasOf = (copy: string) =>
  html`<div class="h-full flex items-center justify-center ps-(--st-shell-inset-left)">
    <div class="w-2xl flex flex-col items-center gap-space-4 text-center text-ui-sm">
      <div class="flex items-center gap-space-2" aria-hidden="true">
        ${ghostBox}${ghostLine}${ghostBox}${ghostLine}${ghostBox}
      </div>
      <p class="m-0 text-et-surface-text font-ui-strong text-ui-md">${FLOWS_LABELS.emptyTitle}</p>
      <p class="m-0 text-et-surface-text-muted">
        Ein Flow verbindet Seiten und ihre Zustände zu einem Weg, den du von links nach rechts liest. Dein Agent legt
        ihn an. Bitte ihn zum Beispiel so:
      </p>
      ${prompt} ${withAction(copy, 'emit:copyPrompt')}
    </div>
  </div>`;

export const emptySide = html`<p class="px-space-3 py-space-2 text-et-surface-text-muted text-ui-sm">
  ${FLOWS_LABELS.none}
</p>`;

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

export const flowGraph = (
  scale: number,
  colGap: number,
  overlay = '',
  onShot?: (id: string, shot: { scale: number }) => string,
) => {
  const rowGap = 56;
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
    return `<figure class="absolute m-0 flex flex-col gap-space-1" style="left:${x}px;top:${y}px">${caption(node.step.title)}<div class="rounded-sm outline outline-et-surface-border"><div class="overflow-hidden" style="width:${w}px;height:${h}px" ${slot('shot')}>${shot(node.step, scale)}</div></div></figure>`;
  }).join('');

  const onShots = onShot
    ? NODES.map((node) => {
        const { x, y } = at(node);
        return `<div class="absolute" style="left:${x}px;top:${y + CAPTION}px;width:${w}px;height:${h}px">${onShot(node.id, { scale })}</div>`;
      }).join('')
    : '';

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
    const label = `<span class="absolute text-center text-et-surface-text-muted text-ui-xs -translate-y-full pb-space-1" style="left:${bend + 4}px;top:${y2}px;width:${x2 - bend - 8}px">${edge.label}</span>`;
    return [{ path, label }];
  });

  const svg = `<svg data-et-drawing class="absolute inset-0 overflow-visible text-et-surface-text-muted" width="${width}" height="${height}" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><defs><marker id="flow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1 9 5 1 9" fill="none" stroke="currentColor" stroke-width="1.5"/></marker></defs>${edges.map((edge) => `<path d="${edge.path}" marker-end="url(#flow-arrow)"/>`).join('')}</svg>`;

  return html`<div class="relative flex-none" style="width:${width}px;height:${height}px">
    ${svg}${frames}${edges.map((edge) => edge.label).join('')}${overlay}${onShots}
  </div>`;
};
