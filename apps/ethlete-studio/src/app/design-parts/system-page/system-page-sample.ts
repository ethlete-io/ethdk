import { PartTreeLayer } from '../part-tree/part-tree.component';

export type OpenPointIcon = 'grid' | 'warning' | 'comment' | 'error' | 'flow';

export type OpenPointGroup = { icon: OpenPointIcon; lines: { text: string; detail: string }[] };

export type PartExceptionSample = { rule: string; reason: string; reopened: boolean };

export const PART_EXCEPTIONS_SAMPLE: PartExceptionSample[] = [
  { rule: 'filled/UNBOUND-INPUT', reason: 'Das Label kommt im Harness aus einem Beispieltext.', reopened: false },
  {
    rule: 'outline/CONTRAST',
    reason: 'Die Kontur liegt bewusst unter 3:1, der Text trägt den Kontrast.',
    reopened: true,
  },
];

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
