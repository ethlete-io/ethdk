type UnchangedRow = { part: string; state: string };

type UnchangedGroup = { part: string; states: string[] };

export const UNCHANGED: UnchangedRow[] = [
  { part: 'pages/inbox', state: 'all' },
  { part: 'pages/inbox', state: 'none' },
  { part: 'components/canvas-viewport', state: 'default' },
  { part: 'components/canvas-viewport', state: 'zoomed-in' },
  { part: 'components/canvas-viewport', state: 'zoomed-out' },
  { part: 'elements/shell-main', state: 'panel-hidden' },
];

export const unchangedGroups = (rows: UnchangedRow[]): UnchangedGroup[] => {
  const byPart = new Map<string, string[]>();

  for (const row of rows) byPart.set(row.part, [...(byPart.get(row.part) ?? []), row.state]);

  return [...byPart].map(([part, states]) => ({ part, states }));
};

export const stateCount = (count: number) => (count === 1 ? '1 Zustand' : `${count} Zustände`);
