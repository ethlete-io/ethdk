import { NormalizedMatch } from '../../match';
import { BracketMatchNormalizer } from '../bracket-card-context';

/**
 * A `matchNormalizer` for the story brackets, whose generated data source carries `data: null` — which is
 * exactly the point: everything below is derived from what the *bracket* knows (participant ids,
 * `winnerSide`, `status`), so it doubles as the worked example for a consumer whose own payload holds
 * nothing presentational.
 *
 * Names and crest colours come from hashing the participant id into a fixed pool, so the same seed reads
 * the same in every round and the demo needs no fixtures.
 */
export const demoMatchNormalizer: BracketMatchNormalizer<unknown, unknown> = (match): NormalizedMatch => {
  const home = demoParticipant(match.home?.id ?? null);
  const away = demoParticipant(match.away?.id ?? null);
  const isCompleted = match.status === 'completed';

  return {
    id: match.id,
    status: isCompleted ? 'finished' : 'scheduled',
    // Derived from the match id so it is stable across re-renders — `new Date()` in a normalizer would
    // change every change-detection pass.
    startTime: new Date(DEMO_EPOCH + (hash(match.id) % 72) * 3_600_000),
    home,
    away,
    homeScore: isCompleted ? (match.winnerSide === 'home' ? 2 : 1) : null,
    awayScore: isCompleted ? (match.winnerSide === 'away' ? 2 : 1) : null,
    resultKind: 'score',
    gameScores: null,
    winnerSide: match.winnerSide,
    label: null,
  };
};

/** A stable non-negative hash of a participant or match id. */
const hash = (value: string) => {
  let total = 0;

  for (let index = 0; index < value.length; index++) {
    total = (total * 31 + value.charCodeAt(index)) % 100_000;
  }

  return total;
};

const DEMO_EPOCH = Date.UTC(2026, 4, 2, 16, 0, 0);

const DEMO_TEAMS = [
  { name: 'FC Berlin', code: 'FCB', fill: '#00ffa1' },
  { name: 'Neon Esports', code: 'NEO', fill: '#00d0ff' },
  { name: 'Rote Löwen Pankow', code: 'RLP', fill: '#ffd000' },
  { name: 'Hafen United', code: 'HAF', fill: '#ff7a00' },
  { name: 'Delay Sports', code: 'DLY', fill: '#ff4d6d' },
  { name: 'Nordost Kickers', code: 'NOK', fill: '#b388ff' },
  { name: 'Spree Rangers', code: 'SPR', fill: '#7cff6b' },
  { name: 'Alpen Wölfe', code: 'ALW', fill: '#63e6ff' },
];

const crest = (config: { label: string; fill: string }) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">' +
      `<rect width="100%" height="100%" fill="${config.fill}"/>` +
      '<text x="50%" y="50%" fill="#000" font-family="sans-serif" font-size="30" text-anchor="middle" ' +
      `dominant-baseline="middle">${config.label}</text></svg>`,
  );

/** `null` in, `null` out — a bracket slot whose feeder hasn't finished is a TBD, not an error. */
export const demoParticipant = (id: string | null) => {
  if (!id) return null;

  const team = DEMO_TEAMS[hash(id) % DEMO_TEAMS.length];

  if (!team) return null;

  return {
    id,
    name: team.name,
    code: team.code,
    subtitle: null,
    emblem: { defaultSrc: crest({ label: team.code, fill: team.fill }) },
    seed: null,
  };
};
