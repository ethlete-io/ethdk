export const COMPETITION = {
  mark: '26',
  eyebrow: 'COMPETITION',
  name: 'FIFAe World Cup 2026™',
  short: 'World Cup 2026™',
};

/** The part of today's strip that is page content about the competition itself. */
export const PAGES = ['Overview', 'Competition Format', 'Selection Process'];

/**
 * The other part of today's strip: the children of the competition stage, each with the
 * `executionStatus` the API already carries.
 */
export const STAGES = [
  { name: 'Challenger Series', detail: '48 players · ranking', status: 'completed' },
  { name: 'Nations League', detail: '32 nations', status: 'completed' },
  { name: 'Continental Championship', detail: 'Finals · Europe', status: 'running' },
  { name: 'FIFAe World Cup 2026™', detail: 'Starts 14 June', status: 'upcoming' },
] as const;

export const LIVE = STAGES[2];

export const CURRENT = PAGES[0];
