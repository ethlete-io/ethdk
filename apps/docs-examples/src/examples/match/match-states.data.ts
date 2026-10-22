import { NormalizedMatch, NormalizedMatchParticipant } from '@ethlete/components';

const emblem = (config: { label: string; fill: string }) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">' +
      `<rect width="100%" height="100%" fill="${config.fill}"/>` +
      '<text x="50%" y="50%" fill="#000" font-family="sans-serif" font-size="34" text-anchor="middle" ' +
      `dominant-baseline="middle">${config.label}</text></svg>`,
  );

const HOME: NormalizedMatchParticipant = {
  id: 'fcb',
  name: 'FC Berlin',
  code: 'FCB',
  subtitle: 'Berlin eSports',
  emblem: { defaultSrc: emblem({ label: 'FCB', fill: '#00ffa1' }) },
  seed: 1,
};

const AWAY: NormalizedMatchParticipant = {
  id: 'neo',
  name: 'Neon Esports',
  code: 'NEO',
  subtitle: 'Neon Gaming Group',
  emblem: { defaultSrc: emblem({ label: 'NEO', fill: '#00d0ff' }) },
  seed: 8,
};

const THIRD: NormalizedMatchParticipant = {
  id: 'rlp',
  name: 'Rote Löwen Pankow',
  code: 'RLP',
  subtitle: null,
  emblem: { defaultSrc: emblem({ label: 'RLP', fill: '#ffd000' }) },
  seed: 4,
};

const KICK_OFF = new Date('2026-05-02T18:30:00Z');

const GAME_SCORES = [
  { home: 13, away: 11 },
  { home: 8, away: 13 },
  { home: 13, away: 9 },
];

const BO7_GAME_SCORES = [
  { home: 3, away: 1 },
  { home: 0, away: 2 },
  { home: 4, away: 3 },
  { home: 1, away: 5 },
  { home: 2, away: 1 },
  { home: 0, away: 3 },
  { home: 4, away: 2 },
];

export const STATE_MATCHES: NormalizedMatch[] = [
  {
    id: 'scheduled',
    status: 'scheduled',
    startTime: KICK_OFF,
    home: HOME,
    away: AWAY,
    homeScore: null,
    awayScore: null,
    resultKind: 'score',
    gameScores: null,
    winnerSide: null,
    label: 'Match 1',
  },
  {
    id: 'live',
    status: 'live',
    startTime: KICK_OFF,
    home: HOME,
    away: THIRD,
    homeScore: 1,
    awayScore: 1,
    resultKind: 'score',
    gameScores: null,
    winnerSide: null,
    label: 'Match 2',
  },
  {
    id: 'finished',
    status: 'finished',
    startTime: KICK_OFF,
    home: THIRD,
    away: AWAY,
    homeScore: 0,
    awayScore: 3,
    resultKind: 'score',
    gameScores: null,
    winnerSide: 'away',
    label: 'Match 3',
  },
  {
    id: 'series',
    status: 'finished',
    startTime: KICK_OFF,
    home: HOME,
    away: AWAY,
    homeScore: 2,
    awayScore: 1,
    resultKind: 'score',
    gameScores: GAME_SCORES,
    winnerSide: 'home',
    label: 'Semi-final',
  },
  {
    id: 'bo7',
    status: 'finished',
    startTime: KICK_OFF,
    home: AWAY,
    away: THIRD,
    homeScore: 4,
    awayScore: 3,
    resultKind: 'score',
    gameScores: BO7_GAME_SCORES,
    winnerSide: 'home',
    label: 'Semi-final 2',
  },
  {
    id: 'points',
    status: 'finished',
    startTime: KICK_OFF,
    home: HOME,
    away: THIRD,
    homeScore: 3,
    awayScore: 0,
    resultKind: 'points',
    gameScores: null,
    winnerSide: 'home',
    label: 'Matchday 14',
  },
  {
    id: 'outcome',
    status: 'finished',
    startTime: KICK_OFF,
    home: THIRD,
    away: HOME,
    homeScore: null,
    awayScore: null,
    resultKind: 'outcome',
    gameScores: null,
    winnerSide: 'away',
    label: 'Group B',
  },
  {
    id: 'tbd',
    status: 'scheduled',
    startTime: null,
    home: HOME,
    away: null,
    homeScore: null,
    awayScore: null,
    resultKind: 'score',
    gameScores: null,
    winnerSide: null,
    label: 'Grand Final',
  },
];
