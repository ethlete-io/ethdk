import { Band } from '../../shared/kerbe';

export const BAND: Band = {
  id: 's',
  kind: 'work',
  ask: 'a glance',
  from: '10:00',
  minutes: 45,
  label: 'ET-772',
  detail: 'fix(repo): Cut the inlay instead of breaking it',
};

export type StateCell = { key: string; name: string; claim: string; marked?: boolean; dragging?: boolean };

export const STATES: StateCell[] = [
  { key: 'rest', name: 'Rest', claim: 'The plate is flat. Only the metal speaks.' },
  { key: 'hover', name: 'Hover', claim: 'The plate lifts one step. The metal does not move.' },
  { key: 'focus', name: 'Focus', claim: 'A ring inside the plate, so a packed lane cannot clip it.' },
  { key: 'press', name: 'Press', claim: 'The plate goes down into the ground.' },
  { key: 'drag', name: 'Drag', claim: 'The band goes translucent and the grid reads through it.', dragging: true },
  { key: 'marked', name: 'Marked for a merge', claim: 'Brackets close on the edge away from the metal.', marked: true },
];
