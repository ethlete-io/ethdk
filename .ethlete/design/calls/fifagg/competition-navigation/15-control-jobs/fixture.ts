export const COMPETITION = {
  name: 'FIFAe World Cup 2026™ ft. eFootball™ Console',
};

export const LIVE = {
  name: 'Continental Championship',
};

/** Everything about the competition that is not one of its stages. */
export const PAGES = [
  'Overview',
  'Competition Format',
  'Selection Process',
  'Ranking',
  'Matchups',
  'Standings',
  'Teams',
  'Prizes',
];

export const VISIBLE_PAGES = PAGES.slice(0, 4);
export const REST_PAGES = PAGES.slice(4);

export const STAGE_COUNT = 4;

export const CURRENT = PAGES[0];
