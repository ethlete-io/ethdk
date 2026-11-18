export type KnownOrphanState = { kind: 'never-written' } | { kind: 'written-by'; writer: string };

export type KnownOrphan = { path: string; backlog: string; state: KnownOrphanState };

const NEVER: KnownOrphanState = { kind: 'never-written' };

export const KNOWN_ORPHAN_ENDPOINTS: KnownOrphan[] = [
  { path: '/__design/notes', backlog: 'B148', state: NEVER },
  { path: '/__design/note', backlog: 'B148', state: NEVER },
  { path: '/__design/note-change', backlog: 'B148', state: NEVER },
  { path: '/__design/note-delete', backlog: 'B148', state: NEVER },
  { path: '/__design/flow-note', backlog: 'B148', state: NEVER },
  { path: '/__design/flow-note-change', backlog: 'B148', state: NEVER },
  { path: '/__design/flow-note-delete', backlog: 'B148', state: NEVER },
  { path: '/__design/sketch-diff', backlog: 'B151', state: NEVER },
  { path: '/__design/sketch-crop', backlog: 'B151', state: NEVER },
  { path: '/__design/motion', backlog: 'B151', state: NEVER },
];
