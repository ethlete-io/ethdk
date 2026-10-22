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

const sourceCase = ({
  title,
  source,
  ...overrides
}: Partial<PickCardCase> & { title: string; source: BracketSlotSource | null }) =>
  pickCardCase(title, {
    bracketMatch: finalOf(source),
    normalized: normalizedFinal({ awayState: 'unavailable' }),
    ...overrides,
  });

const unresolvedCase = ({ title, ...overrides }: Partial<PickCardCase> & { title: string }) =>
  pickCardCase(title, {
    bracketMatch: finalOf(bracketSlot.matchOutcome('semi-2', 'winner')),
    normalized: normalizedFinal({ awayState: 'unresolvable' }),
    ...overrides,
  });

export const CASES: PickCardCase[] = [
  sourceCase({
    title: "match-outcome, the earlier match's winner",
    source: bracketSlot.matchOutcome('semi-2', 'winner'),
  }),
  sourceCase({
    title: "match-outcome, the earlier match's loser",
    source: bracketSlot.matchOutcome('semi-2', 'loser'),
  }),
  sourceCase({
    title: 'standing-rank',
    source: bracketSlot.standingRank('group-a', 2, 'Group A'),
  }),
  sourceCase({ title: 'seed', source: bracketSlot.seed(3) }),
  sourceCase({ title: 'swiss-bucket', source: bracketSlot.swissBucket() }),
  sourceCase({ title: 'bye', source: bracketSlot.bye() }),
  sourceCase({ title: 'external', source: { kind: 'external' } }),
  sourceCase({ title: 'no source at all', source: null }),
  sourceCase({
    title: "the competition's own wording, which always wins",
    source: bracketSlot.seed(3, 'Host nation'),
  }),
  unresolvedCase({ title: 'a side a prediction could still name' }),
  unresolvedCase({ title: 'the same side, with no earlier round left to predict', earlierRoundsClosed: true }),
];
