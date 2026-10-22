import { NormalizedMatch, NormalizedMatchParticipant } from '@ethlete/components';

const crest = (config: { label: string; fill: string }) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">' +
      `<rect width="100%" height="100%" fill="${config.fill}"/>` +
      '<text x="50%" y="50%" fill="#000" font-family="sans-serif" font-size="30" text-anchor="middle" ' +
      `dominant-baseline="middle">${config.label}</text></svg>`,
  );

const team = (config: {
  id: string;
  name: string;
  code: string;
  subtitle: string | null;
  fill: string;
  seed: number;
}) => ({
  id: config.id,
  name: config.name,
  code: config.code,
  subtitle: config.subtitle,
  emblem: { defaultSrc: crest({ label: config.code, fill: config.fill }) },
  seed: config.seed,
});

const HOME: NormalizedMatchParticipant = team({
  id: 'fcb',
  name: 'FC Berlin',
  code: 'FCB',
  subtitle: 'Berlin eSports',
  fill: '#00ffa1',
  seed: 1,
});

const AWAY: NormalizedMatchParticipant = team({
  id: 'neo',
  name: 'Neon Esports',
  code: 'NEO',
  subtitle: 'Neon Gaming Group',
  fill: '#00d0ff',
  seed: 4,
});

const THIRD: NormalizedMatchParticipant = team({
  id: 'rlp',
  name: 'Rote Löwen Pankow',
  code: 'RLP',
  subtitle: null,
  fill: '#ffd000',
  seed: 7,
});

const KICK_OFF = new Date('2026-05-02T18:30:00Z');

const railMatch = (config: {
  id: string;
  home: NormalizedMatchParticipant;
  away: NormalizedMatchParticipant;
  status: NormalizedMatch['status'];
  homeScore: number | null;
  awayScore: number | null;
  winnerSide: 'home' | 'away' | null;
}): NormalizedMatch => ({
  id: config.id,
  status: config.status,
  startTime: KICK_OFF,
  home: config.home,
  away: config.away,
  homeScore: config.homeScore,
  awayScore: config.awayScore,
  resultKind: 'score',
  gameScores: null,
  winnerSide: config.winnerSide,
  label: null,
});

export const RAIL_MATCHES: NormalizedMatch[] = [
  railMatch({ id: 'r1', home: HOME, away: AWAY, status: 'finished', homeScore: 2, awayScore: 1, winnerSide: 'home' }),
  railMatch({ id: 'r2', home: AWAY, away: THIRD, status: 'live', homeScore: 1, awayScore: 1, winnerSide: null }),
  railMatch({
    id: 'r3',
    home: THIRD,
    away: HOME,
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
    winnerSide: null,
  }),
  railMatch({
    id: 'r4',
    home: HOME,
    away: THIRD,
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
    winnerSide: null,
  }),
  railMatch({
    id: 'r5',
    home: AWAY,
    away: HOME,
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
    winnerSide: null,
  }),
];
