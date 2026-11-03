export type KnownOrphan = { path: string; backlog: string };

export const KNOWN_ORPHAN_ENDPOINTS: KnownOrphan[] = [
  { path: '/__design/comment', backlog: 'B145' },
  { path: '/__design/comment-done', backlog: 'B145' },
  { path: '/__design/comment-withdraw', backlog: 'B145' },
  { path: '/__design/comment-reply', backlog: 'B145' },
  { path: '/__design/notes', backlog: 'B148' },
  { path: '/__design/note', backlog: 'B148' },
  { path: '/__design/note-change', backlog: 'B148' },
  { path: '/__design/note-delete', backlog: 'B148' },
  { path: '/__design/flow-note', backlog: 'B148' },
  { path: '/__design/flow-note-change', backlog: 'B148' },
  { path: '/__design/flow-note-delete', backlog: 'B148' },
  { path: '/__design/sketch-diff', backlog: 'B151' },
  { path: '/__design/sketch-crop', backlog: 'B151' },
  { path: '/__design/motion', backlog: 'B151' },
  { path: '/__design/part-ready', backlog: 'B151' },
];
