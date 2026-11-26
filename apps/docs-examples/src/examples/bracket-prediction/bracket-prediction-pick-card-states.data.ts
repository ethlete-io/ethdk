import {
  BracketMatch,
  BracketMatchId,
  BracketPickCardNoteTone,
  bracketSlot,
  BracketSlotSource,
  createBracket,
  MatchParticipantSide,
  NormalizedMatch,
  NormalizedMatchParticipant,
  NormalizedMatchSideState,
} from '@ethlete/components';

const RED: NormalizedMatchParticipant = {
  id: 'red',
  name: 'Red Foxes',
  code: 'FOX',
  subtitle: null,
  emblem: null,
  seed: 1,
};
const GOLD: NormalizedMatchParticipant = {
  id: 'gold',
  name: 'Golden Owls',
  code: 'OWL',
  subtitle: null,
  emblem: null,
  seed: 2,
};

const finalOf = (awaySource: BracketSlotSource | null): BracketMatch<null, null> => {
  const bracket = createBracket<null, null>(
    {
      mode: 'single-elimination',
      rounds: [
        { id: 'semi-finals', name: 'Semi-finals', type: 'single-elimination-bracket', data: null },
        { id: 'final', name: 'Final', type: 'final', data: null },
      ],
      matches: [
        {
          id: 'semi-1',
          roundId: 'semi-finals',
          home: 'red',
          away: 'blue',
          winner: 'home',
          status: 'completed',
          data: null,
        },
        {
          id: 'final',
          roundId: 'final',
          home: 'red',
          away: null,
          homeSource: bracketSlot.matchOutcome('semi-1', 'winner'),
          awaySource,
          winner: null,
          status: 'pending',
          data: null,
        },
      ],
    },
    { layout: 'left-to-right' },
  );

  const final = bracket.matches.get('final' as BracketMatchId);

  if (!final) throw new Error('The demo source above must contain a match called "final".');

  return final;
};

const normalizedFinal = (options: {
  away?: NormalizedMatchParticipant | null;
  awayState?: NormalizedMatchSideState;
  winnerSide?: MatchParticipantSide | null;
}): NormalizedMatch => ({
  id: 'final',
  status: 'scheduled',
  startTime: null,
  home: RED,
  away: options.away ?? null,
  homeState: 'occupied',
  awayState: options.awayState ?? (options.away ? 'occupied' : 'unavailable'),
  homeScore: null,
  awayScore: null,
  resultKind: 'score',
  gameScores: null,
  winnerSide: options.winnerSide ?? null,
  label: null,
});

export type PickCardCase = {
  title: string;
  bracketMatch: BracketMatch<null, null>;
  normalized: NormalizedMatch;
  pickedSide: MatchParticipantSide | null;
  note: string | null;
  noteTone: BracketPickCardNoteTone;
  locked: boolean;
  disabled: boolean;
  readonly: boolean;
  earlierRoundsClosed: boolean;
};

const pickCardCase = (title: string, overrides: Partial<PickCardCase> = {}): PickCardCase => ({
  title,
  bracketMatch: finalOf(null),
  normalized: normalizedFinal({ away: GOLD }),
  pickedSide: null,
  note: null,
  noteTone: 'muted',
  locked: false,
  disabled: false,
  readonly: false,
  earlierRoundsClosed: false,
  ...overrides,
});

export const CASES: PickCardCase[] = [
  pickCardCase('Picked, and still changeable', { pickedSide: 'home' }),
  pickCardCase('A muted note', {
    pickedSide: 'home',
    note: 'Followed Red Foxes from Semi-final 1',
  }),
  pickCardCase('An invalid note, which outlines the card too', {
    note: 'Blue Whales - no longer in this match',
    noteTone: 'invalid',
  }),
  pickCardCase('Locked - the deadline passed, the pick stays', { pickedSide: 'home', locked: true }),
  pickCardCase('Disabled - this viewer may not pick here', { disabled: true }),
  pickCardCase('Readonly - a results view; this pick was on the side that lost', {
    pickedSide: 'away',
    normalized: normalizedFinal({ away: GOLD, winnerSide: 'home' }),
    readonly: true,
  }),
];
