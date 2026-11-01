import { control } from '@ethlete/components/design/control';
import { definePart, drawing, html } from '@design-system';
import button from '@system/components/button';
import partTree from '@system/elements/part-tree';
import shellMain from '@system/elements/shell-main';
import { studioMenu } from '@system/elements/studio-menu';

type Status = 'declared' | 'owned' | 'undeclared' | 'unclassified';

type Box = { x: number; y: number; width: number; height: number };

type Entry = { id: string; label?: string; status: Status; owner?: string; kind: string; states: number; box: Box };

type Props = { inventory: 'open' | 'approvable' | 'approved' | 'loading' };

const SCALE = 0.5;

const ENTRIES: Entry[] = [
  {
    id: 'studio-menu',
    label: 'Studio',
    status: 'undeclared',
    kind: 'button',
    states: 1,
    box: { x: 12, y: 12, width: 40, height: 40 },
  },
  {
    id: 'rail.system',
    label: 'System',
    status: 'owned',
    owner: 'elements/shell-main',
    kind: 'button',
    states: 2,
    box: { x: 12, y: 72, width: 40, height: 40 },
  },
  {
    id: 'rail.flows',
    label: 'Flows',
    status: 'owned',
    owner: 'elements/shell-main',
    kind: 'button',
    states: 2,
    box: { x: 12, y: 120, width: 40, height: 40 },
  },
  {
    id: 'flow-row',
    label: 'Sketch prüfen',
    status: 'declared',
    kind: 'row',
    states: 2,
    box: { x: 72, y: 72, width: 216, height: 28 },
  },
  {
    id: 'preset-picker',
    label: 'Desktop · 1440 × 900',
    status: 'unclassified',
    kind: 'select',
    states: 1,
    box: { x: 1172, y: 20, width: 240, height: 36 },
  },
];

const resolvedOf = (entry: Entry): Entry =>
  entry.status === 'undeclared' || entry.status === 'unclassified' ? { ...entry, status: 'declared' } : entry;

const SEMANTIC: Record<Status, string> = {
  declared: '',
  owned: '',
  undeclared: ' data-et-semantic-color="error"',
  unclassified: ' data-et-semantic-color="warning"',
};

const STATUS_TEXT: Record<Status, string> = {
  declared: 'deklariert',
  owned: 'zugeordnet',
  undeclared: 'nicht deklariert',
  unclassified: 'nicht eingeordnet',
};

const APPROVAL: Record<Props['inventory'], string> = {
  open: 'Noch nicht freigegeben',
  approvable: 'Noch nicht freigegeben',
  approved: 'Vom Designer am 31.10.2026, 14:20:00 freigegeben',
  loading: '',
};

const boxOf = (entry: Entry, number: number) =>
  html`<div
    class="pointer-events-none absolute border-2 border-et-theme"
    style="left:${entry.box.x * SCALE}px;top:${entry.box.y * SCALE}px;width:${entry.box.width * SCALE}px;height:${entry.box.height * SCALE}px"
    ${SEMANTIC[entry.status]}
  >
    <span class="absolute -top-2 -left-2 rounded-full bg-et-theme px-1 font-code text-ui-xs leading-4 text-et-theme-ink"
      >${number}</span
    >
  </div>`;

const entryOf = (entry: Entry, number: number) =>
  html`<li class="flex gap-space-2 text-ui-sm" ${SEMANTIC[entry.status]}>
    <span class="h-fit shrink-0 rounded-full bg-et-theme px-1.5 font-code text-et-theme-ink">${number}</span>
    <span class="flex min-w-0 flex-col">
      ${entry.label ? `<span class="text-et-surface">${entry.label}</span>` : ''}
      <span class="font-code break-all text-et-surface">${entry.id}</span>
      <span class="text-et-surface-muted"
        >${entry.owner ? `gehört zu ${entry.owner}` : STATUS_TEXT[entry.status]} · ${entry.kind} · ${entry.states}
        ${entry.states === 1 ? 'Zustand' : 'Zustände'}</span
      >
    </span>
  </li>`;

const frameOf = (entries: Entry[]) =>
  html`<figure class="m-0 flex flex-col gap-space-2">
    <figcaption class="font-code text-ui-sm text-et-surface-muted">Flow · Desktop · Dunkel</figcaption>
    <div class="relative self-start border border-et-surface-border">
      <div class="bg-et-surface-bg" style="width:${1440 * SCALE}px;height:${900 * SCALE}px"></div>
      ${entries.map(boxOf).join('')}
    </div>
  </figure>`;

const listOf = (entries: Entry[]) =>
  html`<ol
    class="m-0 flex min-h-0 list-none flex-col gap-space-2 overflow-auto border-l border-et-surface-border p-space-4"
  >
    ${entries.map(entryOf).join('')}
  </ol>`;

export default definePart<Props>({
  note: 'The Inventory of a page, shown in place of the canvas when the Inventory toggle of a page is on: a header with the approval state, Reload and Approve inventory, the rest frames of the page with a numbered box on each control, and the numbered control list at the right with its status, kind and state count. An undeclared control is red, an unclassified one amber; Approve stays off while either is left.',
  madeBy: ['claude-opus-5-5'],
  implements: {
    route: '/',
    component: 'apps/ethlete-studio/src/app/design-parts/inventory-page/inventory-page.component.ts',
  },
  states: {
    open: { inventory: 'open' },
    approvable: { inventory: 'approvable' },
    approved: { inventory: 'approved' },
    loading: { inventory: 'loading' },
  },
  controls: {
    'inventory-toggle': { kind: 'button', part: 'components/button' },
    reload: { kind: 'button', part: 'components/button' },
    approve: { kind: 'button', part: 'components/button' },
  },
  render: async ({ inventory }) => {
    const entries = inventory === 'open' ? ENTRIES : ENTRIES.map(resolvedOf);
    const loading = inventory === 'loading';
    const toggle = await button.render({ label: 'Inventory', variant: 'outline', size: 'sm', pressed: true });
    const reload = await button.render({ label: 'Neu laden', variant: 'outline', size: 'sm', disabled: loading });
    const approve = await button.render({
      label: 'Inventory freigeben',
      variant: 'filled',
      size: 'sm',
      disabled: inventory !== 'approvable',
    });
    const tree = await partTree.render({
      layers: [
        { title: 'Foundations', open: false, parts: [] },
        { title: 'Elements', open: false, parts: [] },
        { title: 'Components', open: false, parts: [] },
        {
          title: 'Pages',
          open: true,
          parts: [{ name: 'flows', leaf: true, selected: true }, { name: 'inbox' }, { name: 'system' }],
        },
      ],
    });
    const body = loading
      ? html`<p class="m-0 p-space-4 text-ui-sm text-et-surface-muted">Inventory wird gezeichnet …</p>`
      : html`<div class="grid min-h-0 grid-cols-[minmax(0,1fr)_32rem]">
          <div class="flex min-h-0 flex-col gap-space-6 overflow-auto p-space-4">${frameOf(entries)}</div>
          ${listOf(entries)}
        </div>`;
    const menu = await studioMenu({ open: false });
    const shell = await shellMain.render({
      studio: menu.body,
      section: 'System',
      product: 'studio',
      side: tree.body,
      content: html`<div class="h-full box-border flex flex-col ps-(--st-shell-inset-left)">
        <div class="flex flex-none items-center gap-space-3 px-space-4 h-14">
          <span class="text-ui-lg font-ui-strong">pages/flows</span>
          <span class="flex-1"></span>
          ${control(toggle.body, 'inventory-toggle')}
        </div>
        <div class="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] bg-et-surface-bg">
          <header
            class="flex flex-wrap items-center gap-space-3 border-b border-et-surface-border px-space-4 py-space-3"
          >
            <h2 class="m-0 text-ui-lg font-ui-strong">Inventory</h2>
            ${loading ? '' : `<span class="text-ui-sm text-et-surface-muted">${APPROVAL[inventory]}</span>`}
            <span class="flex-1"></span>
            ${control(reload.body, 'reload')} ${control(approve.body, 'approve')}
          </header>
          ${body}
        </div>
      </div>`,
    });

    return drawing({
      body: shell.body,
      setup: menu.setup,
      styles: shell.styles + menu.styles + tree.styles + toggle.styles + reload.styles + approve.styles,
    });
  },
});
