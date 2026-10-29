import { definePart, drawing, html } from '@design-system';
import styles from './tree-row.css?inline';

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
  hovered?: boolean;
};

type Props = { rows: Row[] };

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

const row = (r: Row) =>
  `<div
        class="st-trow"
        style="--depth: ${r.depth}"
        tabindex="0"
        data-kind="${r.kind}"
        ${r.hovered ? 'data-hover' : ''}
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
  { label: 'empty', depth: 2, kind: 'leaf', hovered: true },
  { label: 'filled', depth: 2, kind: 'leaf', inert: true },
  { label: 'select', depth: 1, kind: 'part', expanded: false, warning: 'Render check: 1 warning' },
  { label: 'tree-row', depth: 1, kind: 'leaf', status: 'in-progress' },
  { label: 'Elements', depth: 0, kind: 'group', expanded: true },
  { label: 'part-tree', depth: 1, kind: 'leaf', status: 'ready', comments: 3 },
  { label: 'Pages', depth: 0, kind: 'group', expanded: false },
];

export default definePart<Props>({
  note: 'One mark family: every end mark is a 12px line icon with the same stroke. A pencil is a sketch in progress, an accent check a ready sketch, a red triangle a render-check warning, and a bubble open comments. Each mark carries its detail, such as the comment count, in a tooltip. The stack has no outer padding; the host sets it.',
  madeBy: ['claude-opus-5-5'],
  widths: [280],
  states: { tree: { rows: tree } },
  render: ({ rows }) => drawing({ body: html`<div class="st-trow-stack">${rows.map(row).join('')}</div>`, styles }),
});
