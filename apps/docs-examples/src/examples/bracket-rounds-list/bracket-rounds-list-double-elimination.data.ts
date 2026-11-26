import {
  BracketDataSource,
  BracketMatchNormalizer,
  NormalizedMatch,
  NormalizedMatchParticipant,
} from '@ethlete/components';

export const SOURCE: BracketDataSource<null, null> = {
  mode: 'double-elimination',
  rounds: [
    { id: 'ub-r0', type: 'upper-bracket', name: 'Winners round 1', data: null },
    { id: 'ub-r1', type: 'upper-bracket', name: 'Winners round 2', data: null },
    { id: 'ub-r2', type: 'upper-bracket', name: 'Winners round 3', data: null },
    { id: 'lb-r0', type: 'lower-bracket', name: 'Losers round 1', data: null },
    { id: 'lb-r1', type: 'lower-bracket', name: 'Losers round 2', data: null },
    { id: 'lb-r2', type: 'lower-bracket', name: 'Losers round 3', data: null },
    { id: 'lb-r3', type: 'lower-bracket', name: 'Losers round 4', data: null },
    { id: 'final', type: 'final', name: 'Grand final', data: null },
    { id: 'reverse-final', type: 'reverse-final', name: 'Bracket reset', data: null },
    { id: 'third-place', type: 'third-place', name: 'Third place', data: null },
  ],
  matches: [
    { id: 'ub-r0-m0', roundId: 'ub-r0', home: 'u1', away: 'u2', winner: 'home', status: 'completed', data: null },
    { id: 'ub-r0-m1', roundId: 'ub-r0', home: 'u3', away: 'u4', winner: 'home', status: 'completed', data: null },
    { id: 'ub-r0-m2', roundId: 'ub-r0', home: 'u5', away: 'u6', winner: 'home', status: 'completed', data: null },
    { id: 'ub-r0-m3', roundId: 'ub-r0', home: 'u7', away: 'u8', winner: 'home', status: 'completed', data: null },
    { id: 'ub-r1-m0', roundId: 'ub-r1', home: 'u1', away: 'u3', winner: 'home', status: 'completed', data: null },
    { id: 'ub-r1-m1', roundId: 'ub-r1', home: 'u5', away: 'u7', winner: 'home', status: 'completed', data: null },
    { id: 'ub-r2-m0', roundId: 'ub-r2', home: 'u1', away: 'u5', winner: 'home', status: 'completed', data: null },
    { id: 'lb-r0-m0', roundId: 'lb-r0', home: 'l0-0h', away: 'l0-0a', winner: 'home', status: 'completed', data: null },
    { id: 'lb-r0-m1', roundId: 'lb-r0', home: 'l0-1h', away: 'l0-1a', winner: 'home', status: 'completed', data: null },
    { id: 'lb-r1-m0', roundId: 'lb-r1', home: 'l1-0h', away: 'l1-0a', winner: 'home', status: 'completed', data: null },
    { id: 'lb-r1-m1', roundId: 'lb-r1', home: 'l1-1h', away: 'l1-1a', winner: 'home', status: 'completed', data: null },
    { id: 'lb-r2-m0', roundId: 'lb-r2', home: 'l2-0h', away: 'l2-0a', winner: 'home', status: 'completed', data: null },
    { id: 'lb-r3-m0', roundId: 'lb-r3', home: 'l3-0h', away: 'l3-0a', winner: 'home', status: 'completed', data: null },
    { id: 'final-m0', roundId: 'final', home: 'u1', away: 'l3-0h', winner: null, status: 'pending', data: null },
    {
      id: 'reverse-final-m0',
      roundId: 'reverse-final',
      home: 'u1',
      away: 'l3-0h',
      winner: null,
      status: 'pending',
      data: null,
    },
    {
      id: 'third-place-m0',
      roundId: 'third-place',
      home: 'tp-h',
      away: 'tp-a',
      winner: null,
      status: 'pending',
      data: null,
    },
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
