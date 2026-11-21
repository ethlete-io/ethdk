import { html } from '@design-system';

export type Props = { inventory: 'open' | 'approvable' | 'approved' | 'loading' };

type Tone = 'ok' | 'error' | 'warning';

type Box = { x: number; y: number; width: number; height: number };

type Row = { number: string; name: string; detail: string; tone: Tone; box?: Box };

type Section = { title: string; rows: Row[] };

type Approval = 'open' | 'approvable' | 'approved';

export type InventoryPage = { part: string; approval: Approval; sections: Section[] };

const SHOT = { width: 1440, height: 900 };

export const FRAME = { width: 360, height: 225 };

const MENU = { x: 12, y: 12, width: 40, height: 40 };

const FLOWS_OPEN: Section[] = [
  {
    title: 'Bedienelemente',
    rows: [
      { number: '1', name: 'Studio', detail: 'nicht deklariert', tone: 'error', box: MENU },
      {
        number: '2',
        name: 'System',
        detail: 'gehört zu elements/shell-main',
        tone: 'ok',
        box: { x: 12, y: 72, width: 40, height: 40 },
      },
      {
        number: '3',
        name: 'Sketch prüfen',
        detail: 'deklariert',
        tone: 'ok',
        box: { x: 72, y: 72, width: 216, height: 28 },
      },
      {
        number: '4',
        name: 'Desktop · 1440 × 900',
        detail: 'nicht eingeordnet',
        tone: 'warning',
        box: { x: 1172, y: 20, width: 240, height: 36 },
      },
    ],
  },
  {
    title: 'Assets',
    rows: [
      { number: 'A1', name: 'Studio-Logo', detail: 'gehört zu foundations/logo', tone: 'ok', box: MENU },
      {
        number: 'A2',
        name: 'Pfeil',
        detail: 'Inline-SVG, nicht aus den Foundations',
        tone: 'error',
        box: { x: 640, y: 420, width: 24, height: 24 },
      },
    ],
  },
  {
    title: 'Overlays',
    rows: [
      {
        number: 'O1',
        name: 'Größe',
        detail: 'gehört zu components/menu',
        tone: 'ok',
        box: { x: 1172, y: 60, width: 240, height: 160 },
      },
    ],
  },
];

const resolved = (sections: Section[]): Section[] =>
  sections.map((section) => ({
    ...section,
    rows: section.rows.map((row) =>
      row.tone === 'ok'
        ? row
        : {
            ...row,
            tone: 'ok',
            detail: section.title === 'Bedienelemente' ? 'deklariert' : 'gehört zu foundations/icons',
          },
    ),
  }));

const INBOX: Section[] = [
  {
    title: 'Bedienelemente',
    rows: [
      { number: '1', name: 'Studio', detail: 'gehört zu elements/studio-menu', tone: 'ok', box: MENU },
      {
        number: '2',
        name: 'Antworten',
        detail: 'gehört zu components/button',
        tone: 'ok',
        box: { x: 1260, y: 820, width: 140, height: 40 },
      },
    ],
  },
  { title: 'Assets', rows: [] },
  { title: 'Overlays', rows: [] },
];

const SYSTEM: Section[] = [
  {
    title: 'Bedienelemente',
    rows: [
      { number: '1', name: 'Studio', detail: 'gehört zu elements/studio-menu', tone: 'ok', box: MENU },
      {
        number: '2',
        name: 'Design Canvas',
        detail: 'gehört zu components/canvas-viewport',
        tone: 'ok',
        box: { x: 300, y: 64, width: 1128, height: 824 },
      },
    ],
  },
  {
    title: 'Assets',
    rows: [{ number: 'A1', name: 'Studio-Logo', detail: 'gehört zu foundations/logo', tone: 'ok', box: MENU }],
  },
  { title: 'Overlays', rows: [] },
];

export const pagesOf = (inventory: Props['inventory']): InventoryPage[] => [
  {
    part: 'pages/flows',
    approval: inventory === 'approved' ? 'approved' : inventory === 'approvable' ? 'approvable' : 'open',
    sections: inventory === 'open' ? FLOWS_OPEN : resolved(FLOWS_OPEN),
  },
  { part: 'pages/inbox', approval: 'approved', sections: INBOX },
  { part: 'pages/system', approval: 'approvable', sections: SYSTEM },
];

const TONE: Record<Tone, string> = {
  ok: ' data-et-semantic-color="success"',
  error: ' data-et-semantic-color="error"',
  warning: ' data-et-semantic-color="warning"',
};

const openCount = (page: InventoryPage) =>
  page.sections.reduce((count, section) => count + section.rows.filter((row) => row.tone !== 'ok').length, 0);

export const APPROVAL: Record<Approval, string> = {
  open: 'Noch nicht freigegeben',
  approvable: 'Noch nicht freigegeben',
  approved: 'Vom Designer am 31.10.2026, 14:20:00 freigegeben',
};

const statusOf = (page: InventoryPage) => {
  const open = openCount(page);

  if (open > 0) return `<span class="text-et-theme"${TONE.error}>${open} offen</span>`;

  return `<span class="text-et-surface-muted">${page.approval === 'approved' ? 'freigegeben' : 'bereit zur Freigabe'}</span>`;
};

const percent = (value: number, of: number) => `${(value / of) * 100}%`;

const markOf = (row: Row) =>
  row.box
    ? html`<div
        class="pointer-events-none absolute border-2 border-et-theme"
        style="left:${percent(row.box.x, SHOT.width)};top:${percent(row.box.y, SHOT.height)};width:${percent(row.box.width, SHOT.width)};height:${percent(row.box.height, SHOT.height)}"
        ${TONE[row.tone]}
      >
        <span
          class="absolute -top-2 -left-2 rounded-full bg-et-theme px-1 font-code text-ui-xs leading-4 text-et-theme-ink"
          >${row.number}</span
        >
      </div>`
    : '';

/** A page's rest frame on the canvas: its name and status above, the shot with a numbered box on every entry. */
export const pageFrame = (page: InventoryPage, selected: boolean, at: { x: number; y: number }) =>
  html`<figure class="absolute m-0 flex flex-col gap-space-1" style="left:${at.x}px;top:${at.y}px">
    <figcaption class="flex items-center gap-space-2 text-ui-sm whitespace-nowrap">
      <span class="${selected ? 'font-ui-strong text-et-surface' : 'text-et-surface'}">${page.part}</span>
      ${statusOf(page)}
    </figcaption>
    <div
      class="relative bg-et-surface-bg ${selected ? 'outline-2 outline-et-surface-border' : 'outline outline-et-surface-border'}"
      style="width:${FRAME.width}px;height:${FRAME.height}px"
    >
      ${page.sections.flatMap((section) => section.rows.map(markOf)).join('')}
    </div>
  </figure>`;

const rowOf = (row: Row) =>
  html`<li class="flex gap-space-2 text-ui-sm" ${TONE[row.tone]}>
    <span class="h-fit shrink-0 rounded-full bg-et-theme px-1.5 font-code text-et-theme-ink">${row.number}</span>
    <span class="flex min-w-0 flex-col">
      <span class="text-et-surface">${row.name}</span>
      <span class="${row.tone === 'ok' ? 'text-et-surface-muted' : 'text-et-theme'}">${row.detail}</span>
    </span>
  </li>`;

/** The entries of one page in three sections; an empty section says so in one line. */
export const pageList = (page: InventoryPage) =>
  page.sections
    .map(
      (section) =>
        html`<section class="flex flex-col gap-space-2">
          <h3 class="m-0 text-ui-sm font-ui-strong text-et-surface">
            ${section.title} <span class="font-ui text-et-surface-muted">${section.rows.length}</span>
          </h3>
          ${
            section.rows.length
              ? `<ol class="m-0 flex list-none flex-col gap-space-2 p-0">${section.rows.map(rowOf).join('')}</ol>`
              : `<p class="m-0 text-ui-sm text-et-surface-muted">Keine</p>`
          }
        </section>`,
    )
    .join('');

export const DRAWING = 'Inventory wird gezeichnet …';
