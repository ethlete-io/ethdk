export type RowInteraction = 'hover' | 'focus-visible';

export type Row = {
  label: string;
  depth: number;
  kind: 'group' | 'part' | 'leaf';
  expanded?: boolean;
  selected?: boolean;
  inert?: boolean;
  warning?: string;
  status?: 'in-progress' | 'ready';
  comments?: number;
  interaction?: RowInteraction;
};

export type Props = { rows: Row[] };

const icon = (paths: string, cls: string) =>
  `<svg class="${cls}" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

const chevron = (open: boolean) =>
  icon(open ? '<path d="m4.5 6.5 3.5 3.5 3.5-3.5"/>' : '<path d="m6.5 4.5 3.5 3.5-3.5 3.5"/>', 'st-trow-chevron');

const mark = (paths: string) =>
  `<svg class="st-trow-mark" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

const bubble = mark('<path d="M3 4.5h10v6H7.5L5 12.5v-2H3z"/>');

const warningIcon = mark('<path d="M8 2.5 14 13H2z"/><path d="M8 6.5v3"/><path d="M8 11.25v.01"/>');

const statusIcon = {
  'in-progress': mark('<path d="M10.5 3 13 5.5 6 12.5H3.5V10z"/><path d="m9 4.5 2.5 2.5"/>'),
  ready: mark('<path d="m3.5 8.5 3 3 6-7"/>'),
};

const statusTitle = { 'in-progress': 'Sketch in progress', ready: 'Sketch ready' };

const lead = ({ kind, expanded, inert }: Row) =>
  kind === 'leaf' ? `<span class="st-trow-dot"${inert ? ' data-inert' : ''}></span>` : chevron(expanded === true);

export const row = (r: Row) =>
  `<div
        class="st-trow"
        style="--depth: ${r.depth}"
        tabindex="0"
        data-kind="${r.kind}"
        ${r.interaction ? `data-et-force="${r.interaction}"` : ''}
        ${r.selected ? 'data-selected' : ''}
      >
        <span class="st-trow-lead">${lead(r)}</span>
        <span class="st-trow-label">${r.label}</span>
        ${r.warning ? `<span class="st-trow-warning" title="${r.warning}">${warningIcon}</span>` : ''}
        ${r.status ? `<span class="st-trow-status" data-status="${r.status}" title="${statusTitle[r.status]}">${statusIcon[r.status]}</span>` : ''}
        ${r.comments ? `<span class="st-trow-comments" title="${r.comments} open comments">${bubble}</span>` : ''}
      </div>`;

const tree: Row[] = [
  { label: 'Foundations', depth: 0, kind: 'group', expanded: false },
  { label: 'Components', depth: 0, kind: 'group', expanded: true },
  { label: 'button', depth: 1, kind: 'leaf', selected: true },
  { label: 'form-field', depth: 1, kind: 'part', expanded: true },
  { label: 'empty', depth: 2, kind: 'leaf', interaction: 'hover' },
  { label: 'filled', depth: 2, kind: 'leaf', inert: true },
  { label: 'select', depth: 1, kind: 'part', expanded: false, warning: 'Render check: 1 warning' },
  { label: 'tree-row', depth: 1, kind: 'leaf', status: 'in-progress' },
  { label: 'Elements', depth: 0, kind: 'group', expanded: true },
  { label: 'part-tree', depth: 1, kind: 'leaf', status: 'ready', comments: 3 },
  { label: 'Pages', depth: 0, kind: 'group', expanded: false },
];

const one = (r: Row): Props => ({ rows: [r] });

const button: Row = { label: 'button', depth: 1, kind: 'leaf' };

export const states = {
  tree: { rows: tree },
  'group-closed': one({ label: 'Foundations', depth: 0, kind: 'group', expanded: false }),
  'group-open': one({ label: 'Components', depth: 0, kind: 'group', expanded: true }),
  'part-closed': one({ label: 'select', depth: 1, kind: 'part', expanded: false }),
  'part-open': one({ label: 'form-field', depth: 1, kind: 'part', expanded: true }),
  leaf: one(button),
  'leaf-flat': one({ label: 'Review a sketch', depth: 0, kind: 'leaf' }),
  'mark-in-progress': one({ ...button, label: 'tree-row', status: 'in-progress' }),
  'mark-ready': one({ ...button, label: 'part-tree', status: 'ready' }),
  'mark-warning': one({ label: 'select', depth: 1, kind: 'part', warning: 'Render check: 1 warning' }),
  'mark-comments': one({ ...button, label: 'part-tree', comments: 3 }),
  hover: one({ ...button, interaction: 'hover' }),
  'focus-visible': one({ ...button, interaction: 'focus-visible' }),
  selected: one({ ...button, selected: true }),
  'selected-hover': one({ ...button, selected: true, interaction: 'hover' }),
  'selected-focus-visible': one({ ...button, selected: true, interaction: 'focus-visible' }),
  'selected-marks': one({ ...button, label: 'part-tree', selected: true, status: 'ready', comments: 3 }),
  inert: one({ label: 'filled', depth: 2, kind: 'leaf', inert: true }),
} satisfies Record<string, Props>;
