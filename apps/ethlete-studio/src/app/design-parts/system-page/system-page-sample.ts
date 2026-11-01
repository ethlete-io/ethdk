import { ButtonVariant } from '@ethlete/components';
import { PartTreeLayer } from '../part-tree/part-tree.component';
import { TreeRow } from '../tree-row/tree-row-item.component';

export type OpenPointIcon = 'grid' | 'warning' | 'comment' | 'error' | 'flow';

export type OpenPointGroup = { icon: OpenPointIcon; lines: { text: string; detail: string }[] };

export type StateGrid<T> = { columns: string[]; rows: { label: string; cell: T }[] };

export type ButtonCell = { label: string; variant: ButtonVariant };

export type TreeFrame = { name: string; width: number; rows: TreeRow[] };

export const SYSTEM_LAYERS: PartTreeLayer[] = [
  { title: 'Foundations', open: false, parts: [] },
  { title: 'Elements', open: false, parts: [] },
  {
    title: 'Components',
    open: true,
    parts: [{ name: 'button', leaf: true, selected: true }, { name: 'form-field' }, { name: 'select', warns: true }],
  },
  { title: 'Pages', open: false, parts: [] },
];

export const MANY_STATES_LAYERS: PartTreeLayer[] = [
  { title: 'Foundations', open: false, parts: [] },
  {
    title: 'Components',
    open: true,
    parts: [
      { name: 'button', leaf: true },
      { name: 'form-field' },
      { name: 'select', warns: true },
      { name: 'tree-row', selected: true, states: [{ name: 'grid' }, { name: 'tree' }] },
    ],
  },
  { title: 'Elements', open: false, parts: [] },
  { title: 'Pages', open: false, parts: [] },
];

const BUTTON_STATES = ['filled', 'outline', 'tonal'] as const;

export const BUTTON_GRID: StateGrid<ButtonCell> = {
  columns: ['rest', 'hover', 'active', 'focus-visible', 'pressed', 'disabled'],
  rows: BUTTON_STATES.map((variant) => ({ label: variant, cell: { label: 'Save', variant } })),
};

const WARNING = 'Render check: 1 warning';

const button: TreeRow = { label: 'button', depth: 1, kind: 'leaf' };

export const TREE_ROW_GRID: StateGrid<TreeRow> = {
  columns: ['rest', 'hover', 'active', 'focus-visible'],
  rows: [
    { label: 'leaf', cell: button },
    { label: 'selected', cell: { ...button, selected: true } },
    { label: 'group-closed', cell: { label: 'Foundations', depth: 0, kind: 'group', expanded: false } },
    { label: 'group-open', cell: { label: 'Components', depth: 0, kind: 'group', expanded: true } },
    { label: 'part-closed', cell: { label: 'select', depth: 1, kind: 'part', expanded: false } },
    { label: 'part-open', cell: { label: 'form-field', depth: 1, kind: 'part', expanded: true } },
    { label: 'leaf-flat', cell: { label: 'Review a sketch', depth: 0, kind: 'leaf' } },
    { label: 'mark-in-progress', cell: { ...button, label: 'tree-row', status: 'in-progress' } },
    { label: 'mark-ready', cell: { ...button, label: 'part-tree', status: 'ready' } },
    { label: 'mark-warning', cell: { label: 'select', depth: 1, kind: 'part', warning: WARNING } },
    { label: 'mark-comments', cell: { ...button, label: 'part-tree', comments: 3 } },
    {
      label: 'selected-marks',
      cell: { ...button, label: 'part-tree', selected: true, status: 'ready', comments: 3 },
    },
    { label: 'inert', cell: { label: 'filled', depth: 2, kind: 'leaf', inert: true } },
  ],
};

export const TREE_FRAME: TreeFrame = {
  name: 'tree',
  width: 280,
  rows: [
    { label: 'Foundations', depth: 0, kind: 'group', expanded: false },
    { label: 'Components', depth: 0, kind: 'group', expanded: true },
    { label: 'button', depth: 1, kind: 'leaf', selected: true },
    { label: 'form-field', depth: 1, kind: 'part', expanded: true },
    { label: 'empty', depth: 2, kind: 'leaf' },
    { label: 'filled', depth: 2, kind: 'leaf', inert: true },
    { label: 'select', depth: 1, kind: 'part', expanded: false, warning: WARNING },
    { label: 'tree-row', depth: 1, kind: 'leaf', status: 'in-progress' },
    { label: 'Elements', depth: 0, kind: 'group', expanded: true },
    { label: 'part-tree', depth: 1, kind: 'leaf', status: 'ready', comments: 3 },
    { label: 'Pages', depth: 0, kind: 'group', expanded: false },
  ],
};

const MOTION_STATES = ['filled', 'outline', 'tonal', 'hover', 'active', 'focus-visible', 'disabled'];

export const OPEN_POINTS_SAMPLE: OpenPointGroup[] = [
  { icon: 'grid', lines: [{ text: 'Keine Controls deklariert', detail: 'controls' }] },
  { icon: 'warning', lines: [{ text: 'label liegt unter der Kontrastregel', detail: 'tonal' }] },
  {
    icon: 'comment',
    lines: [
      { text: 'Wartet auf den Agenten', detail: 'outline' },
      { text: 'Beantwortet, wartet auf dich', detail: 'filled' },
    ],
  },
  { icon: 'error', lines: [{ text: 'Kein App-Code verknüpft', detail: 'implements' }] },
  {
    icon: 'flow',
    lines: MOTION_STATES.flatMap((from) =>
      MOTION_STATES.filter((to) => to !== from).map((to) => ({ text: `${from} → ${to}`, detail: 'motion' })),
    ),
  },
];
