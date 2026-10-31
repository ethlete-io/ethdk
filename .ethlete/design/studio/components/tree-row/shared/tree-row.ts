import { forceInteraction } from '@design-system';
import { icon } from '@system/foundations/icons';

type RowInteraction = 'hover' | 'focus-visible' | 'active';

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

const chevron = (open: boolean) => icon(open ? 'chevron-down' : 'chevron-right');

const bubble = icon('comment', { size: 12 });

const warningIcon = icon('warning', { size: 12 });

const statusIcon = {
  'in-progress': icon('pencil', { size: 12 }),
  ready: icon('check', { size: 12 }),
};

const statusTitle = { 'in-progress': 'Sketch in progress', ready: 'Sketch ready' };

const dot = (inert?: boolean) =>
  `<span class="st-trow-dot box-border${inert ? '' : ' bg-current'}"${inert ? ' data-inert' : ''}></span>`;

const lead = ({ kind, expanded, inert }: Row) => (kind === 'leaf' ? dot(inert) : chevron(expanded === true));

const statusClass = { 'in-progress': 'text-et-surface-muted', ready: 'text-et-theme' };

const rowMarkup = (r: Row) => {
  const accent = r.selected ? 'text-et-theme-ink' : 'text-et-surface-muted';
  const color = r.selected ? 'text-et-theme-ink' : r.kind === 'group' ? 'text-et-surface-muted' : 'text-et-surface';

  return `<div
        class="st-trow relative flex items-center gap-space-1 rounded-control-sm ${r.selected ? 'bg-et-theme/20 ' : ''}hover:bg-et-surface-interaction/9 active:bg-et-surface-interaction/15 ${color} whitespace-nowrap outline-none cursor-default"
        style="--depth: ${r.depth}"
        tabindex="0"
        data-et-surface-interactive
        data-kind="${r.kind}"
        ${r.selected ? 'data-selected' : ''}
      >
        <span class="st-trow-lead flex flex-none items-center justify-center ${accent}">${lead(r)}</span>
        <span class="flex-1 min-w-0 overflow-hidden text-ellipsis">${r.label}</span>
        ${r.warning ? `<span class="st-trow-warning flex flex-none text-et-theme" data-et-semantic-color="warning" title="${r.warning}">${warningIcon}</span>` : ''}
        ${r.status ? `<span class="flex flex-none ${statusClass[r.status]}" title="${statusTitle[r.status]}">${statusIcon[r.status]}</span>` : ''}
        ${r.comments ? `<span class="flex flex-none items-center gap-0.5 ${accent} text-(length:--text-xs)" title="${r.comments} open comments">${bubble}</span>` : ''}
      </div>`;
};

export const row = (r: Row) => (r.interaction ? forceInteraction(rowMarkup(r), r.interaction) : rowMarkup(r));

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
  active: one({ ...button, interaction: 'active' }),
  'focus-visible': one({ ...button, interaction: 'focus-visible' }),
  selected: one({ ...button, selected: true }),
  'selected-hover': one({ ...button, selected: true, interaction: 'hover' }),
  'selected-active': one({ ...button, selected: true, interaction: 'active' }),
  'selected-focus-visible': one({ ...button, selected: true, interaction: 'focus-visible' }),
  'selected-marks': one({ ...button, label: 'part-tree', selected: true, status: 'ready', comments: 3 }),
  inert: one({ label: 'filled', depth: 2, kind: 'leaf', inert: true }),
} satisfies Record<string, Props>;
