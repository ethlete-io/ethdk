/** The longest name the platform really carries. The row no longer states it. */
export const COMPETITION = {
  name: 'Cyprus Football Association Esports Competition - Featuring Rocket League',
};

/** A stage carries one name. `Group Stage · Week 4` was invented. */
export const LIVE = {
  name: 'Group Stage',
};

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
