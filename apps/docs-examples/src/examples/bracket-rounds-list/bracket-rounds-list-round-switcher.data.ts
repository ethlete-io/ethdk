import {
  BracketDataSource,
  BracketMatchNormalizer,
  NormalizedMatch,
  NormalizedMatchParticipant,
} from '@ethlete/components';

export const SOURCE: BracketDataSource<null, null> = {
  mode: 'single-elimination',
  rounds: [
    { id: 'se-r0', type: 'single-elimination-bracket', name: 'Round 1', data: null },
    { id: 'se-r1', type: 'single-elimination-bracket', name: 'Round 2', data: null },
    { id: 'se-r2', type: 'single-elimination-bracket', name: 'Round 3', data: null },
    { id: 'se-r3', type: 'final', name: 'Final', data: null },
  ],
  matches: [
    { id: 'se-r0-m0', roundId: 'se-r0', home: 'p1', away: 'p2', winner: 'home', status: 'completed', data: null },
    { id: 'se-r0-m1', roundId: 'se-r0', home: 'p3', away: 'p4', winner: 'home', status: 'completed', data: null },
    { id: 'se-r0-m2', roundId: 'se-r0', home: 'p5', away: 'p6', winner: 'home', status: 'completed', data: null },
    { id: 'se-r0-m3', roundId: 'se-r0', home: 'p7', away: 'p8', winner: 'home', status: 'completed', data: null },
    { id: 'se-r0-m4', roundId: 'se-r0', home: 'p9', away: 'p10', winner: 'home', status: 'completed', data: null },
    { id: 'se-r0-m5', roundId: 'se-r0', home: 'p11', away: 'p12', winner: 'home', status: 'completed', data: null },
    { id: 'se-r0-m6', roundId: 'se-r0', home: 'p13', away: 'p14', winner: 'home', status: 'completed', data: null },
    { id: 'se-r0-m7', roundId: 'se-r0', home: 'p15', away: 'p16', winner: 'home', status: 'completed', data: null },
    { id: 'se-r1-m0', roundId: 'se-r1', home: 'p1', away: 'p3', winner: 'home', status: 'completed', data: null },
    { id: 'se-r1-m1', roundId: 'se-r1', home: 'p5', away: 'p7', winner: 'home', status: 'completed', data: null },
    { id: 'se-r1-m2', roundId: 'se-r1', home: 'p9', away: 'p11', winner: 'home', status: 'completed', data: null },
    { id: 'se-r1-m3', roundId: 'se-r1', home: 'p13', away: 'p15', winner: 'home', status: 'completed', data: null },
    { id: 'se-r2-m0', roundId: 'se-r2', home: 'p1', away: 'p5', winner: 'home', status: 'completed', data: null },
    { id: 'se-r2-m1', roundId: 'se-r2', home: 'p9', away: 'p13', winner: 'home', status: 'completed', data: null },
    { id: 'se-r3-m0', roundId: 'se-r3', home: 'p1', away: 'p9', winner: 'home', status: 'completed', data: null },
  ],
};

const TEAMS = [
  { name: 'FC Berlin', code: 'FCB', fill: '#00ffa1' },
  { name: 'Neon Esports', code: 'NEO', fill: '#00d0ff' },
  { name: 'Rote Löwen Pankow', code: 'RLP', fill: '#ffd000' },
  { name: 'Hafen United', code: 'HAF', fill: '#ff7a00' },
  { name: 'Delay Sports', code: 'DLY', fill: '#ff4d6d' },
  { name: 'Nordost Kickers', code: 'NOK', fill: '#b388ff' },
  { name: 'Spree Rangers', code: 'SPR', fill: '#7cff6b' },
  { name: 'Alpen Wölfe', code: 'ALW', fill: '#63e6ff' },
];

const hash = (value: string) => {
  let total = 0;

  for (let index = 0; index < value.length; index++) {
    total = (total * 31 + value.charCodeAt(index)) % 100_000;
  }

  return total;
};

const crest = (config: { label: string; fill: string }) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">' +
      `<rect width="100%" height="100%" fill="${config.fill}"/>` +
      '<text x="50%" y="50%" fill="#000" font-family="sans-serif" font-size="30" text-anchor="middle" ' +
      `dominant-baseline="middle">${config.label}</text></svg>`,
  );

const toParticipant = (id: string | null): NormalizedMatchParticipant | null => {
  const team = id ? TEAMS[hash(id) % TEAMS.length] : null;

  return id && team
    ? {
        id,
        name: team.name,
        code: team.code,
        subtitle: null,
        emblem: { defaultSrc: crest({ label: team.code, fill: team.fill }) },
        seed: null,
      }
    : null;
};

export const normalizeMatch: BracketMatchNormalizer<null, null> = (match): NormalizedMatch => {
  const finished = match.status === 'completed';

  return {
    id: match.id,
    status: finished ? 'finished' : 'scheduled',
    startTime: new Date(Date.UTC(2026, 4, 2, 16) + (hash(match.id) % 72) * 3_600_000),
    home: toParticipant(match.home?.id ?? null),
    away: toParticipant(match.away?.id ?? null),
    homeScore: finished ? (match.winnerSide === 'home' ? 2 : 1) : null,
    awayScore: finished ? (match.winnerSide === 'away' ? 2 : 1) : null,
    resultKind: 'score',
    gameScores: null,
    winnerSide: match.winnerSide,
    label: null,
  };
};
