import { definePart, drawing, html } from '@design-system';
import styles from './tree-row.css?inline';

type Row = {
  label: string;
  depth: number;
  kind: 'group' | 'leaf';
  expanded?: boolean;
  selected?: boolean;
  status?: 'in-progress' | 'ready';
  comments?: number;
  hovered?: boolean;
};

type Props = { rows: Row[] };

const icon = (paths: string, cls: string) =>
  `<svg class="${cls}" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

const chevron = (open: boolean) =>
  icon(open ? '<path d="m4.5 6.5 3.5 3.5 3.5-3.5"/>' : '<path d="m6.5 4.5 3.5 3.5-3.5 3.5"/>', 'st-trow-chevron');

const bubble = icon('<path d="M3 4.5h10v6H7.5L5 12.5v-2H3z"/>', 'st-trow-bubble');

const statusTitle = { 'in-progress': 'Sketch in progress', ready: 'Sketch ready' };

const row = ({ label, depth, kind, expanded, selected, status, comments, hovered }: Row) =>
  `<div
        class="st-trow"
        style="--depth: ${depth}"
        tabindex="0"
        ${hovered ? 'data-hover' : ''}
        ${selected ? 'data-selected' : ''}
        ${kind === 'group' ? 'data-group' : ''}
      >
        <span class="st-trow-lead"
          >${kind === 'group' ? chevron(expanded === true) : '<span class="st-trow-dot"></span>'}</span
        >
        <span class="st-trow-label">${label}</span>
        ${status ? `<span class="st-trow-status" data-status="${status}" title="${statusTitle[status]}"></span>` : ''}
        ${comments ? `<span class="st-trow-comments" title="${comments} open comments">${bubble}${comments}</span>` : ''}
      </div>`;

const tree: Row[] = [
  { label: 'Foundations', depth: 0, kind: 'group', expanded: false },
  { label: 'Components', depth: 0, kind: 'group', expanded: true },
  { label: 'button', depth: 1, kind: 'leaf', selected: true },
  { label: 'form-field', depth: 1, kind: 'leaf', hovered: true },
  { label: 'select', depth: 1, kind: 'leaf', status: 'in-progress' },
  { label: 'tree-row', depth: 1, kind: 'leaf', status: 'ready', comments: 2 },
  { label: 'Elements', depth: 0, kind: 'group', expanded: true },
  { label: 'part-tree', depth: 1, kind: 'leaf', comments: 3 },
  { label: 'Pages', depth: 0, kind: 'group', expanded: false },
];

export default definePart<Props>({
  note: 'The part tree row as part-tree draws it today, extracted: chevron or dot lead, 16 px per level, a subtle accent fill when selected, and two quiet trailing marks, a status dot and a comment glyph with its count.',
  madeBy: ['claude-opus-5-5'],
  widths: [280],
  states: { tree: { rows: tree } },
  render: ({ rows }) => drawing({ body: html`<div class="st-trow-stack">${rows.map(row).join('')}</div>`, styles }),
});
