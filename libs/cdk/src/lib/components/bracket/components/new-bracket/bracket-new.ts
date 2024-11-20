import {
  MatchListViewUnion,
  OpponentSide,
  RoundStageStructureView,
  RoundStageStructureWithMatchesView,
  RoundType,
} from '@ethlete/types';

export type BracketRoundId = string & { __brand: 'BracketRoundId' };
export type BracketMatchId = string & { __brand: 'BracketMatchId' };
export type BracketRoundPosition = number & { __brand: 'BracketRoundPosition' };
export type BracketMatchPosition = number & { __brand: 'BracketMatchPosition' };
export type MatchParticipantId = string & { __brand: 'MatchParticipantId' };
export type BracketRoundSwissGroupId = string & { __brand: 'BracketRoundSwissGroupId' };

// Will usually be 0.5, 1 or 2. In Swiss this value will be gibberish
export type MatchFactor = number;

export const FALLBACK_MATCH_POSITION = -1 as BracketMatchPosition;

export const TOURNAMENT_MODE = {
  SINGLE_ELIMINATION: 'single-elimination',
  DOUBLE_ELIMINATION: 'double-elimination',
  GROUP: 'group',
  SWISS: 'swiss',
  SWISS_WITH_ELIMINATION: 'swiss-with-elimination',
} as const;

export type TournamentMode = (typeof TOURNAMENT_MODE)[keyof typeof TOURNAMENT_MODE];

export const COMMON_BRACKET_ROUND_TYPE = {
  THIRD_PLACE: 'third-place',
  FINAL: 'final',
} as const;

export const SINGLE_ELIMINATION_BRACKET_ROUND_TYPE = {
  SINGLE_ELIMINATION_BRACKET: 'single-elimination-bracket',
} as const;

export const DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE = {
  UPPER_BRACKET: 'upper-bracket',
  LOWER_BRACKET: 'lower-bracket',
  REVERSE_FINAL: 'reverse-final',
} as const;

export const SWISS_BRACKET_ROUND_TYPE = {
  SWISS: 'swiss',
} as const;

export const GROUP_BRACKET_ROUND_TYPE = {
  GROUP: 'group',
} as const;

export type CommonBracketRoundType = (typeof COMMON_BRACKET_ROUND_TYPE)[keyof typeof COMMON_BRACKET_ROUND_TYPE];
export type SingleEliminationBracketRoundType =
  | CommonBracketRoundType
  | (typeof SINGLE_ELIMINATION_BRACKET_ROUND_TYPE)[keyof typeof SINGLE_ELIMINATION_BRACKET_ROUND_TYPE];
export type DoubleEliminationBracketRoundType =
  | CommonBracketRoundType
  | (typeof DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE)[keyof typeof DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE];
export type SwissBracketRoundType = (typeof SWISS_BRACKET_ROUND_TYPE)[keyof typeof SWISS_BRACKET_ROUND_TYPE];
export type GroupBracketRoundType = (typeof GROUP_BRACKET_ROUND_TYPE)[keyof typeof GROUP_BRACKET_ROUND_TYPE];

export type BracketRoundType =
  | SingleEliminationBracketRoundType
  | DoubleEliminationBracketRoundType
  | SwissBracketRoundType
  | GroupBracketRoundType;

export type BracketRoundSource<TRoundData> = {
  type: BracketRoundType;
  id: string;
  data: TRoundData;
  name: string;
};

export const BRACKET_ROUND_MIRROR_TYPE = {
  LEFT: 'left',
  RIGHT: 'right',
} as const;

export type BracketRoundMirrorType = (typeof BRACKET_ROUND_MIRROR_TYPE)[keyof typeof BRACKET_ROUND_MIRROR_TYPE];

export type BracketRound<TRoundData, TMatchData> = {
  // NOTE: This is the logical index inside the bracket.
  // In a double elimination bracket, the first round of the lower bracket will have the same index as the final round of the upper bracket
  index: number;
  type: BracketRoundType;
  id: BracketRoundId;
  data: TRoundData;
  position: BracketRoundPosition;
  name: string;
  matchCount: number;
  matches: BracketMatchMap<TRoundData, TMatchData>;
  mirrorRoundType: BracketRoundMirrorType | null;
  isFirstRound: boolean;
};

export type BracketMatchStatus = 'completed' | 'pending';

export type BracketMatch<TRoundData, TMatchData> = {
  data: TMatchData;
  indexInRound: number;
  id: BracketMatchId;
  round: BracketRound<TRoundData, TMatchData>;
  position: BracketMatchPosition;
  home: MatchParticipantId | null;
  away: MatchParticipantId | null;
  winner: OpponentSide | null;
  status: BracketMatchStatus;
};

export type BracketMatchSource<TMatchData> = {
  data: TMatchData;
  id: string;
  roundId: string;
  home: string | null;
  away: string | null;
  winner: OpponentSide | null;
  status: BracketMatchStatus;
};

export type BracketRoundMap<TRoundData, TMatchData> = Map<BracketRoundId, BracketRound<TRoundData, TMatchData>>;
export type BracketMatchMap<TRoundData, TMatchData> = Map<BracketMatchId, BracketMatch<TRoundData, TMatchData>>;

export type BracketData<TRoundData, TMatchData> = {
  rounds: BracketRoundMap<TRoundData, TMatchData>;
  roundIds: BracketRoundId[];
  matches: BracketMatchMap<TRoundData, TMatchData>;
  matchIds: BracketMatchId[];
  participants: BracketParticipantMap<TRoundData, TMatchData>;
  mode: TournamentMode;
};

export type BracketDataSource<TRoundData, TMatchData> = {
  rounds: BracketRoundSource<TRoundData>[];
  matches: BracketMatchSource<TMatchData>[];
  mode: TournamentMode;
};

export type AnyBracketData = BracketData<unknown, unknown>;

// One match has one previous match and one next match (this would be the case, if a group tournament is being displayed via a bracket)
export type BracketMatchRelationOneToOne<TRoundData, TMatchData> = {
  type: 'one-to-one';
  currentMatch: BracketMatch<TRoundData, TMatchData>;
  currentRound: BracketRound<TRoundData, TMatchData>;
  previousMatch: BracketMatch<TRoundData, TMatchData>;
  previousRound: BracketRound<TRoundData, TMatchData>;
  nextMatch: BracketMatch<TRoundData, TMatchData>;
  nextRound: BracketRound<TRoundData, TMatchData>;
};

// The match has no previous match but a single next match (eg. the start of the bracket)
export type BracketMatchRelationNothingToOne<TRoundData, TMatchData> = {
  type: 'nothing-to-one';
  currentMatch: BracketMatch<TRoundData, TMatchData>;
  currentRound: BracketRound<TRoundData, TMatchData>;
  nextMatch: BracketMatch<TRoundData, TMatchData>;
  nextRound: BracketRound<TRoundData, TMatchData>;
};

// The match has no next match but a single previous match (eg. reverse finals)
export type BracketMatchRelationOneToNothing<TRoundData, TMatchData> = {
  type: 'one-to-nothing';
  currentMatch: BracketMatch<TRoundData, TMatchData>;
  currentRound: BracketRound<TRoundData, TMatchData>;
  previousMatch: BracketMatch<TRoundData, TMatchData>;
  previousRound: BracketRound<TRoundData, TMatchData>;
};

// The match has two previous matches and one next match (eg. a normal match in the bracket that is neither the start nor the end)
export type BracketMatchRelationTwoToOne<TRoundData, TMatchData> = {
  type: 'two-to-one';
  currentMatch: BracketMatch<TRoundData, TMatchData>;
  currentRound: BracketRound<TRoundData, TMatchData>;
  previousUpperMatch: BracketMatch<TRoundData, TMatchData>;
  previousUpperRound: BracketRound<TRoundData, TMatchData>;
  previousLowerMatch: BracketMatch<TRoundData, TMatchData>;
  previousLowerRound: BracketRound<TRoundData, TMatchData>;
  nextMatch: BracketMatch<TRoundData, TMatchData>;
  nextRound: BracketRound<TRoundData, TMatchData>;
};

// The match has two previous matches and no next match (eg. the finals in a single elimination bracket)
export type BracketMatchRelationTwoToNothing<TRoundData, TMatchData> = {
  type: 'two-to-nothing';
  currentMatch: BracketMatch<TRoundData, TMatchData>;
  currentRound: BracketRound<TRoundData, TMatchData>;
  previousUpperMatch: BracketMatch<TRoundData, TMatchData>;
  previousUpperRound: BracketRound<TRoundData, TMatchData>;
  previousLowerMatch: BracketMatch<TRoundData, TMatchData>;
  previousLowerRound: BracketRound<TRoundData, TMatchData>;
};

export type BracketMatchRelation<TRoundData, TMatchData> =
  | BracketMatchRelationOneToOne<TRoundData, TMatchData>
  | BracketMatchRelationTwoToOne<TRoundData, TMatchData>
  | BracketMatchRelationNothingToOne<TRoundData, TMatchData>
  | BracketMatchRelationOneToNothing<TRoundData, TMatchData>
  | BracketMatchRelationTwoToNothing<TRoundData, TMatchData>;

export type BracketMatchRelationsMap<TRoundData, TMatchData> = Map<
  BracketMatchId,
  BracketMatchRelation<TRoundData, TMatchData>
>;

// One round has one next round (the first round of the bracket)
export type BracketRoundRelationNothingToOne<TRoundData, TMatchData> = {
  type: 'nothing-to-one';
  currentRound: BracketRound<TRoundData, TMatchData>;
  nextRound: BracketRound<TRoundData, TMatchData>;
  nextRoundMatchFactor: number;
};

// One round has one previous round (eg. the finals round of the bracket in case of a single elimination bracket)
export type BracketRoundRelationOneToNothing<TRoundData, TMatchData> = {
  type: 'one-to-nothing';
  currentRound: BracketRound<TRoundData, TMatchData>;
  previousRound: BracketRound<TRoundData, TMatchData>;
  previousRoundMatchFactor: number;
  rootRoundMatchFactor: number;
};

// One round has one previous round and one next round (eg. a normal round in the bracket that is neither the start nor the end)
export type BracketRoundRelationOneToOne<TRoundData, TMatchData> = {
  type: 'one-to-one';
  currentRound: BracketRound<TRoundData, TMatchData>;
  previousRound: BracketRound<TRoundData, TMatchData>;
  nextRound: BracketRound<TRoundData, TMatchData>;
  nextRoundMatchFactor: number;
  previousRoundMatchFactor: number;
  rootRoundMatchFactor: number;
};

// One round has two previous rounds and one next round (eg. the finals round in a double elimination bracket when the reverse finals is also being played)
export type BracketRoundRelationTwoToOne<TRoundData, TMatchData> = {
  type: 'two-to-one';
  currentRound: BracketRound<TRoundData, TMatchData>;
  previousUpperRound: BracketRound<TRoundData, TMatchData>;
  previousLowerRound: BracketRound<TRoundData, TMatchData>;
  nextRound: BracketRound<TRoundData, TMatchData>;
  nextRoundMatchFactor: number;
  previousUpperRoundMatchFactor: number;
  previousLowerRoundMatchFactor: number;
  upperRootRoundMatchFactor: number;
  lowerRootRoundMatchFactor: number;
};

// One round has two previous rounds and no next round (eg. the finals round in a double elimination bracket when the reverse finals is not being played)
export type BracketRoundRelationTwoToNothing<TRoundData, TMatchData> = {
  type: 'two-to-nothing';
  currentRound: BracketRound<TRoundData, TMatchData>;
  previousUpperRound: BracketRound<TRoundData, TMatchData>;
  previousLowerRound: BracketRound<TRoundData, TMatchData>;
  previousUpperRoundMatchFactor: number;
  previousLowerRoundMatchFactor: number;
  upperRootRoundMatchFactor: number;
  lowerRootRoundMatchFactor: number;
};

// TODO: Add one to two to support split double elimination brackets
export type BracketRoundRelation<TRoundData, TMatchData> =
  | BracketRoundRelationNothingToOne<TRoundData, TMatchData>
  | BracketRoundRelationOneToNothing<TRoundData, TMatchData>
  | BracketRoundRelationOneToOne<TRoundData, TMatchData>
  | BracketRoundRelationTwoToOne<TRoundData, TMatchData>
  | BracketRoundRelationTwoToNothing<TRoundData, TMatchData>;

export type BracketRoundRelations<TRoundData, TMatchData> = Map<
  BracketRoundId,
  BracketRoundRelation<TRoundData, TMatchData>
>;

export type MatchPositionMaps<TRoundData, TMatchData> = Map<
  BracketRoundId,
  Map<BracketMatchPosition, BracketMatch<TRoundData, TMatchData>>
>;

export type ParticipantMatchResult = 'win' | 'loss' | 'tie';
export type ParticipantMatchType = BracketRoundType;

export type MatchParticipantMatch<TRoundData, TMatchData> = {
  bracketMatch: BracketMatch<TRoundData, TMatchData>;
  result: ParticipantMatchResult | null;
  isEliminated: boolean;
  isEliminationMatch: boolean;
  isFirstRound: boolean;
  isLastRound: boolean;
  tieCount: number;
  winCount: number;
  lossCount: number;
};

export type MatchParticipant<TRoundData, TMatchData> = {
  id: MatchParticipantId;
  name: string;
  matches: Map<BracketMatchId, MatchParticipantMatch<TRoundData, TMatchData>>;
};

export type BracketParticipantMatch<TRoundData, TMatchData> = {
  side: OpponentSide;
  bracketMatch: BracketMatch<TRoundData, TMatchData>;
};

export type BracketParticipant<TRoundData, TMatchData> = {
  id: MatchParticipantId;
  name: string;
  matches: Map<BracketMatchId, BracketParticipantMatch<TRoundData, TMatchData>>;
};

export type BracketParticipantMap<TRoundData, TMatchData> = Map<
  MatchParticipantId,
  BracketParticipant<TRoundData, TMatchData>
>;

export type MatchParticipantMap<TRoundData, TMatchData> = Map<
  MatchParticipantId,
  MatchParticipant<TRoundData, TMatchData>
>;

export type BracketRoundSwissGroup<TRoundData, TMatchData> = {
  id: BracketRoundSwissGroupId;
  name: string;
  matches: BracketMatchMap<TRoundData, TMatchData>;
  allowedMatchCount: number;
};

export type BracketRoundSwissGroupMap<TRoundData, TMatchData> = Map<
  BracketRoundSwissGroupId,
  BracketRoundSwissGroup<TRoundData, TMatchData>
>;

export type BracketRoundSwissData<TRoundData, TMatchData> = {
  groups: BracketRoundSwissGroupMap<TRoundData, TMatchData>;
};

export type BracketRoundMapWithSwissData<TRoundData, TMatchData> = Map<
  BracketRoundId,
  BracketRoundSwissData<TRoundData, TMatchData>
>;

export type BracketRoundTypeMap<TRoundData, TMatchData> = Map<
  BracketRoundType,
  BracketRoundMap<TRoundData, TMatchData>
>;

export const generateRoundTypeFromEthleteRoundType = (
  type: RoundType,
  tournamentMode: TournamentMode,
): BracketRoundType => {
  switch (type) {
    case 'normal':
      switch (tournamentMode) {
        case 'single-elimination':
          return SINGLE_ELIMINATION_BRACKET_ROUND_TYPE.SINGLE_ELIMINATION_BRACKET;
        case 'group':
          return GROUP_BRACKET_ROUND_TYPE.GROUP;
        case 'swiss':
          return SWISS_BRACKET_ROUND_TYPE.SWISS;
        default:
          throw new Error(`Unsupported tournament mode for a normal type round: ${tournamentMode}`);
      }
    case 'third_place':
      return COMMON_BRACKET_ROUND_TYPE.THIRD_PLACE;
    case 'final':
      return COMMON_BRACKET_ROUND_TYPE.FINAL;
    case 'reverse_final':
      return DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.REVERSE_FINAL;
    case 'winner_bracket':
      return DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.UPPER_BRACKET;
    case 'loser_bracket':
      return DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.LOWER_BRACKET;
  }
};

export const generateTournamentModeFormEthleteRounds = (
  source: RoundStageStructureWithMatchesView[],
): TournamentMode => {
  const firstRound = source[0];
  const firstMatch = firstRound?.matches[0];

  if (!firstRound) throw new Error('No rounds found');
  if (!firstMatch) throw new Error('No matches found');

  switch (firstMatch.matchType) {
    case 'groups':
      return TOURNAMENT_MODE.GROUP;
    case 'fifa_swiss': {
      const lastRound = source[source.length - 1];

      if (!lastRound) throw new Error('No last round found');

      if (lastRound.matches.length !== firstRound.matches.length) {
        return TOURNAMENT_MODE.SWISS_WITH_ELIMINATION;
      } else {
        return TOURNAMENT_MODE.SWISS;
      }
    }
    case 'double_elimination':
      return TOURNAMENT_MODE.DOUBLE_ELIMINATION;
    case 'single_elimination':
      return TOURNAMENT_MODE.SINGLE_ELIMINATION;
    default:
      throw new Error(`Unsupported tournament mode: ${firstMatch.matchType}`);
  }
};

export const canRenderLayoutInTournamentMode = (layout: BracketDataLayout, mode: TournamentMode): boolean => {
  switch (mode) {
    case TOURNAMENT_MODE.SINGLE_ELIMINATION:
      return layout === BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT || layout === BRACKET_DATA_LAYOUT.MIRRORED;
    default:
      return layout === BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT;
  }
};

export const BRACKET_DATA_LAYOUT = {
  LEFT_TO_RIGHT: 'left-to-right',

  // Currently only supported in single elimination brackets. Will throw an error if used in other bracket types
  MIRRORED: 'mirrored',
} as const;

export type BracketDataLayout = (typeof BRACKET_DATA_LAYOUT)[keyof typeof BRACKET_DATA_LAYOUT];

export const FIRST_ROUNDS_TYPE = {
  SINGLE: 'single',
  DOUBLE: 'double',
} as const;

export type FirstRoundsType = (typeof FIRST_ROUNDS_TYPE)[keyof typeof FIRST_ROUNDS_TYPE];

export type FirstSingleRounds<TRoundData, TMatchData> = {
  type: typeof FIRST_ROUNDS_TYPE.SINGLE;
  first: BracketRound<TRoundData, TMatchData>;
};

export type FirstDoubleRounds<TRoundData, TMatchData> = {
  type: typeof FIRST_ROUNDS_TYPE.DOUBLE;
  upper: BracketRound<TRoundData, TMatchData>;
  lower: BracketRound<TRoundData, TMatchData>;
};

export type FirstRounds<TRoundData, TMatchData> =
  | FirstSingleRounds<TRoundData, TMatchData>
  | FirstDoubleRounds<TRoundData, TMatchData>;

export const getFirstRounds = <TRoundData, TMatchData>(
  bracketData: BracketData<TRoundData, TMatchData>,
  roundTypeMap: BracketRoundTypeMap<TRoundData, TMatchData>,
): FirstRounds<TRoundData, TMatchData> => {
  if (bracketData.mode === TOURNAMENT_MODE.DOUBLE_ELIMINATION) {
    const upper = roundTypeMap.get(DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.UPPER_BRACKET)?.values().next().value;
    const lower = roundTypeMap.get(DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.LOWER_BRACKET)?.values().next().value;

    if (!upper || !lower) throw new Error('Upper or lower bracket is null');

    return {
      type: FIRST_ROUNDS_TYPE.DOUBLE,
      upper,
      lower,
    };
  }

  const first = bracketData.rounds.values().next().value;

  if (!first) throw new Error('First round is null');

  return {
    type: FIRST_ROUNDS_TYPE.SINGLE,
    first,
  };
};

export const generateMatchPositionMaps = <TRoundData, TMatchData>(bracketData: BracketData<TRoundData, TMatchData>) => {
  const matchPositionMaps: MatchPositionMaps<TRoundData, TMatchData> = new Map();

  for (const round of bracketData.rounds.values()) {
    const matchMap = new Map([...round.matches.values()].map((m) => [m.position, m]));

    matchPositionMaps.set(round.id, matchMap);
  }

  return matchPositionMaps;
};

export const generateBracketRoundTypeMap = <TRoundData, TMatchData>(
  bracketData: BracketData<TRoundData, TMatchData>,
) => {
  const roundAmountMap: BracketRoundTypeMap<TRoundData, TMatchData> = new Map();

  for (const round of bracketData.rounds.values()) {
    if (!roundAmountMap.has(round.type)) {
      roundAmountMap.set(round.type, new Map([[round.id, round]]));
    } else {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      roundAmountMap.set(round.type, roundAmountMap.get(round.type)!.set(round.id, round));
    }
  }

  return roundAmountMap;
};

export const generateRoundRelations = <TRoundData, TMatchData>(bracketData: BracketData<TRoundData, TMatchData>) => {
  const roundRelations: BracketRoundRelations<TRoundData, TMatchData> = new Map();

  const allRounds = bracketData.roundIds.map((id) => bracketData.rounds.get(id)).filter((r) => !!r);
  const upperRounds = allRounds.filter((r) => r.type !== DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.LOWER_BRACKET);
  const lowerRounds = allRounds.filter((r) => r.type === DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.LOWER_BRACKET);

  const firstUpperRound = upperRounds[0] || null;
  const firstLowerRound = lowerRounds[0] || null;

  if (!firstUpperRound) throw new Error('firstUpperRound is null');

  const hasLowerRounds = lowerRounds.length > 0;
  const lastLowerRound = lowerRounds[lowerRounds.length - 1] || null;

  for (const [currentUpperRoundIndex, currentUpperRound] of upperRounds.entries()) {
    const isLeftToRight =
      currentUpperRound.mirrorRoundType === null ||
      currentUpperRound.mirrorRoundType === BRACKET_ROUND_MIRROR_TYPE.LEFT;

    const relativePreviousUpperRound = upperRounds[currentUpperRoundIndex - 1] || null;
    const relativeNextUpperRound = upperRounds[currentUpperRoundIndex + 1] || null;

    const previousUpperRound = isLeftToRight ? relativePreviousUpperRound : relativeNextUpperRound;
    const nextUpperRound = isLeftToRight ? relativeNextUpperRound : relativePreviousUpperRound;

    const currentLowerRound = lowerRounds[currentUpperRoundIndex] || null;
    const previousLowerRound = lowerRounds[currentUpperRoundIndex - 1] || null;
    const nextLowerRound = lowerRounds[currentUpperRoundIndex + 1] || null;

    const isLastUpperRound =
      !nextUpperRound ||
      (nextUpperRound.mirrorRoundType === BRACKET_ROUND_MIRROR_TYPE.RIGHT &&
        currentUpperRound.mirrorRoundType === null);

    const isFinal = currentUpperRound.type === COMMON_BRACKET_ROUND_TYPE.FINAL;

    if (isFinal && hasLowerRounds) {
      // two to one relation

      if (!lastLowerRound || !currentLowerRound || !previousUpperRound)
        throw new Error('lastLowerRound or currentLowerRound or previousUpperRound is null');

      // in a sync double elimination bracket, the final round has the same index as the last lower round
      // in an async one, there is always one more round in the lower bracket since we only display a section of the whole tournament
      const isAsyncBracket = currentLowerRound.id !== lastLowerRound.id;
      const finalLowerRound = isAsyncBracket ? nextLowerRound : currentLowerRound;

      if (!finalLowerRound) throw new Error('finalLowerRound is null');
      if (!firstLowerRound) throw new Error('firstLowerRound is null');

      if (finalLowerRound.id !== lastLowerRound.id) throw new Error('finalLowerRound is not the last lower round');

      // if we have a reverse final
      if (nextUpperRound) {
        // for the final
        roundRelations.set(currentUpperRound.id, {
          type: 'two-to-one',
          previousUpperRound: previousUpperRound,
          previousLowerRound: finalLowerRound,
          nextRound: nextUpperRound,
          currentRound: currentUpperRound,
          nextRoundMatchFactor: nextUpperRound.matchCount / currentUpperRound.matchCount,
          previousUpperRoundMatchFactor: previousUpperRound.matchCount / currentUpperRound.matchCount,
          previousLowerRoundMatchFactor: finalLowerRound.matchCount / currentUpperRound.matchCount,
          upperRootRoundMatchFactor: firstUpperRound.matchCount / currentUpperRound.matchCount,
          lowerRootRoundMatchFactor: firstLowerRound.matchCount / currentUpperRound.matchCount,
        });
      } else {
        // no reverse final means the final is the last round

        // for the final
        roundRelations.set(currentUpperRound.id, {
          type: 'two-to-nothing',
          previousUpperRound: previousUpperRound,
          previousLowerRound: finalLowerRound,
          currentRound: currentUpperRound,
          previousLowerRoundMatchFactor: finalLowerRound.matchCount / currentUpperRound.matchCount,
          previousUpperRoundMatchFactor: previousUpperRound.matchCount / currentUpperRound.matchCount,
          lowerRootRoundMatchFactor: firstLowerRound.matchCount / currentUpperRound.matchCount,
          upperRootRoundMatchFactor: firstUpperRound.matchCount / currentUpperRound.matchCount,
        });
      }

      if (isAsyncBracket) {
        // if this is an async bracket, we need to set the relations for the 2 last lower rounds since they will be skipped by the default one to one logic
        const preFinalLowerRound = lowerRounds[lowerRounds.length - 2] || null;
        const prePreFinalLowerRound = lowerRounds[lowerRounds.length - 3] || null;

        if (!preFinalLowerRound) throw new Error('preFinalLowerRound is null');

        if (!firstLowerRound) throw new Error('firstLowerRound is null');

        // for the last lower round
        roundRelations.set(finalLowerRound.id, {
          type: 'one-to-one',
          previousRound: preFinalLowerRound,
          nextRound: currentUpperRound,
          currentRound: finalLowerRound,
          nextRoundMatchFactor: currentUpperRound.matchCount / finalLowerRound.matchCount,
          previousRoundMatchFactor: preFinalLowerRound.matchCount / finalLowerRound.matchCount,
          rootRoundMatchFactor: firstLowerRound.matchCount / finalLowerRound.matchCount,
        });

        if (prePreFinalLowerRound) {
          // for the pre final lower round
          roundRelations.set(preFinalLowerRound.id, {
            type: 'one-to-one',
            previousRound: prePreFinalLowerRound,
            nextRound: finalLowerRound,
            currentRound: preFinalLowerRound,
            nextRoundMatchFactor: finalLowerRound.matchCount / preFinalLowerRound.matchCount,
            previousRoundMatchFactor: prePreFinalLowerRound.matchCount / preFinalLowerRound.matchCount,
            rootRoundMatchFactor: firstLowerRound.matchCount / preFinalLowerRound.matchCount,
          });
        } else {
          // for the first lower round
          roundRelations.set(preFinalLowerRound.id, {
            type: 'nothing-to-one',
            nextRound: finalLowerRound,
            currentRound: preFinalLowerRound,
            nextRoundMatchFactor: finalLowerRound.matchCount / preFinalLowerRound.matchCount,
          });
        }
      } else {
        // this is a sync bracket, we only need to set the relation for the last lower round
        if (!previousLowerRound) throw new Error('previousLowerRound is null');
        if (!firstLowerRound) throw new Error('firstLowerRound is null');

        // for the last lower round
        roundRelations.set(finalLowerRound.id, {
          type: 'one-to-one',
          previousRound: previousLowerRound,
          nextRound: currentUpperRound,
          currentRound: finalLowerRound,
          nextRoundMatchFactor: currentUpperRound.matchCount / finalLowerRound.matchCount,
          previousRoundMatchFactor: previousLowerRound.matchCount / finalLowerRound.matchCount,
          rootRoundMatchFactor: firstLowerRound.matchCount / finalLowerRound.matchCount,
        });
      }
    } else if (isLastUpperRound) {
      // one to nothing relation

      if (!previousUpperRound) throw new Error('previousUpperRound is null');

      roundRelations.set(currentUpperRound.id, {
        type: 'one-to-nothing',
        previousRound: previousUpperRound,
        currentRound: currentUpperRound,
        previousRoundMatchFactor: previousUpperRound.matchCount / currentUpperRound.matchCount,
        rootRoundMatchFactor: firstUpperRound.matchCount / currentUpperRound.matchCount,
      });
    } else if (currentUpperRound.isFirstRound) {
      // nothing to one relation

      if (!nextUpperRound) throw new Error('nextUpperRound is null');

      roundRelations.set(currentUpperRound.id, {
        type: 'nothing-to-one',
        nextRound: nextUpperRound,
        currentRound: currentUpperRound,
        nextRoundMatchFactor: nextUpperRound.matchCount / currentUpperRound.matchCount,
      });

      if (currentLowerRound) {
        if (!nextLowerRound) throw new Error('nextLowerRound is null');

        roundRelations.set(currentLowerRound.id, {
          type: 'nothing-to-one',
          nextRound: nextLowerRound,
          currentRound: currentLowerRound,
          nextRoundMatchFactor: nextLowerRound.matchCount / currentLowerRound.matchCount,
        });
      }
    } else {
      // one to one relation

      if (!previousUpperRound) throw new Error('previousUpperRound is null');
      if (!nextUpperRound) throw new Error('nextUpperRound is null');

      roundRelations.set(currentUpperRound.id, {
        type: 'one-to-one',
        previousRound: previousUpperRound,
        nextRound: nextUpperRound,
        currentRound: currentUpperRound,
        nextRoundMatchFactor: nextUpperRound.matchCount / currentUpperRound.matchCount,
        previousRoundMatchFactor: previousUpperRound.matchCount / currentUpperRound.matchCount,
        rootRoundMatchFactor: firstUpperRound.matchCount / currentUpperRound.matchCount,
      });

      // we only want to set lower rounds here until the special merging point of the final.
      // lower bracket rounds after and including the final will be set in the final round block
      if (currentLowerRound && currentUpperRound.type === DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.UPPER_BRACKET) {
        if (!previousLowerRound) throw new Error('previousLowerRound is null');
        if (!nextLowerRound) throw new Error('nextLowerRound is null');
        if (!firstLowerRound) throw new Error('firstLowerRound is null');

        roundRelations.set(currentLowerRound.id, {
          type: 'one-to-one',
          previousRound: previousLowerRound,
          nextRound: nextLowerRound,
          currentRound: currentLowerRound,
          nextRoundMatchFactor: nextLowerRound.matchCount / currentLowerRound.matchCount,
          previousRoundMatchFactor: previousLowerRound.matchCount / currentLowerRound.matchCount,
          rootRoundMatchFactor: firstLowerRound.matchCount / currentLowerRound.matchCount,
        });
      }
    }
  }

  return roundRelations;
};

export const generateMatchRelations = <TRoundData, TMatchData>(
  bracketData: BracketData<TRoundData, TMatchData>,
  roundRelations: BracketRoundRelations<TRoundData, TMatchData>,
  matchPositionMaps: MatchPositionMaps<TRoundData, TMatchData>,
) => {
  const matchRelations: BracketMatchRelationsMap<TRoundData, TMatchData> = new Map();

  for (const match of bracketData.matches.values()) {
    const currentRelation = roundRelations.get(match.round.id);

    if (!currentRelation) throw new Error('Match round not found');

    const { nextRoundMatchPosition, previousLowerRoundMatchPosition, previousUpperRoundMatchPosition } =
      generateMatchRelationPositions(currentRelation, match);

    switch (currentRelation.type) {
      case 'nothing-to-one': {
        const nextMatch = matchPositionMaps.get(currentRelation.nextRound.id)?.get(nextRoundMatchPosition);

        if (!nextMatch) throw new Error('Next round match not found');

        // means left is nothing. right is one
        matchRelations.set(match.id, {
          type: 'nothing-to-one',
          currentMatch: match,
          currentRound: currentRelation.currentRound,
          nextRound: currentRelation.nextRound,
          nextMatch,
        });

        break;
      }
      case 'one-to-nothing': {
        const previousUpperMatch = matchPositionMaps
          .get(currentRelation.previousRound.id)
          ?.get(previousUpperRoundMatchPosition);
        const previousLowerMatch = matchPositionMaps
          .get(currentRelation.previousRound.id)
          ?.get(previousLowerRoundMatchPosition);

        if (!previousUpperMatch) throw new Error('Previous round match not found');

        if (previousUpperRoundMatchPosition !== previousLowerRoundMatchPosition) {
          // means left is two. right is one

          if (!previousLowerMatch) throw new Error('Previous lower round match not found');

          matchRelations.set(match.id, {
            type: 'two-to-nothing',
            currentMatch: match,
            currentRound: currentRelation.currentRound,
            previousUpperMatch,
            previousUpperRound: currentRelation.previousRound,
            previousLowerMatch,
            previousLowerRound: currentRelation.previousRound,
          });
        } else {
          // means left is one. right is nothing
          matchRelations.set(match.id, {
            type: 'one-to-nothing',
            currentMatch: match,
            currentRound: currentRelation.currentRound,
            previousMatch: previousUpperMatch,
            previousRound: currentRelation.previousRound,
          });
        }

        break;
      }

      case 'one-to-one': {
        const nextMatch = matchPositionMaps.get(currentRelation.nextRound.id)?.get(nextRoundMatchPosition);
        const previousUpperMatch = matchPositionMaps
          .get(currentRelation.previousRound.id)
          ?.get(previousUpperRoundMatchPosition);
        const previousLowerMatch = matchPositionMaps
          .get(currentRelation.previousRound.id)
          ?.get(previousLowerRoundMatchPosition);

        if (!nextMatch) throw new Error('Next round match not found');
        if (!previousUpperMatch) throw new Error(`Previous upper round match not found`);
        if (!previousLowerMatch) throw new Error('Previous lower round match not found');

        // can be either one to one or two to one
        const isLeftOne = previousUpperRoundMatchPosition === previousLowerRoundMatchPosition;

        if (isLeftOne) {
          // one-to-one
          matchRelations.set(match.id, {
            type: 'one-to-one',
            currentMatch: match,
            currentRound: currentRelation.currentRound,
            previousMatch: previousUpperMatch,
            previousRound: currentRelation.previousRound,
            nextMatch,
            nextRound: currentRelation.nextRound,
          });
        } else {
          // two-to-one
          matchRelations.set(match.id, {
            type: 'two-to-one',
            currentMatch: match,
            currentRound: currentRelation.currentRound,
            previousUpperMatch,
            previousUpperRound: currentRelation.previousRound,
            previousLowerMatch,
            previousLowerRound: currentRelation.previousRound,
            nextMatch,
            nextRound: currentRelation.nextRound,
          });
        }

        break;
      }
      case 'two-to-one': {
        const nextMatch = matchPositionMaps.get(currentRelation.nextRound.id)?.get(nextRoundMatchPosition);

        const previousUpperMatch = matchPositionMaps
          .get(currentRelation.previousUpperRound.id)
          ?.get(previousUpperRoundMatchPosition);
        const previousLowerMatch = matchPositionMaps
          .get(currentRelation.previousLowerRound.id)
          ?.get(previousLowerRoundMatchPosition);

        if (!nextMatch) throw new Error('Next round match not found');
        if (!previousUpperMatch) throw new Error(`Previous upper round match not found`);
        if (!previousLowerMatch) throw new Error('Previous lower round match not found');

        matchRelations.set(match.id, {
          type: 'two-to-one',
          currentMatch: match,
          currentRound: currentRelation.currentRound,
          previousUpperMatch,
          previousUpperRound: currentRelation.previousUpperRound,
          previousLowerMatch,
          previousLowerRound: currentRelation.previousLowerRound,
          nextMatch,
          nextRound: currentRelation.nextRound,
        });

        break;
      }
      case 'two-to-nothing': {
        const previousUpperMatch = matchPositionMaps
          .get(currentRelation.previousUpperRound.id)
          ?.get(previousUpperRoundMatchPosition);
        const previousLowerMatch = matchPositionMaps
          .get(currentRelation.previousUpperRound.id)
          ?.get(previousLowerRoundMatchPosition);

        if (!previousUpperMatch) throw new Error(`Previous upper round match not found`);
        if (!previousLowerMatch) throw new Error('Previous lower round match not found');

        matchRelations.set(match.id, {
          type: 'two-to-nothing',
          currentMatch: match,
          currentRound: currentRelation.currentRound,
          previousUpperMatch,
          previousUpperRound: currentRelation.previousUpperRound,
          previousLowerMatch,
          previousLowerRound: currentRelation.previousUpperRound,
        });

        break;
      }
    }
  }

  return matchRelations;
};

export const generateMatchRelationPositions = <TRoundData, TMatchData>(
  currentRelation: BracketRoundRelation<TRoundData, TMatchData>,
  match: BracketMatch<TRoundData, TMatchData>,
) => {
  switch (currentRelation.type) {
    case 'nothing-to-one': {
      return {
        nextRoundMatchPosition: generateMatchPosition(match, currentRelation.nextRoundMatchFactor),
        previousUpperRoundMatchPosition: FALLBACK_MATCH_POSITION,
        previousLowerRoundMatchPosition: FALLBACK_MATCH_POSITION,
      };
    }
    case 'one-to-nothing': {
      const previousRoundHasDoubleTheMatchCount = currentRelation.previousRoundMatchFactor === 2;
      const doubleUpperMatchCountShift = previousRoundHasDoubleTheMatchCount ? 1 : 0;

      return {
        nextRoundMatchPosition: FALLBACK_MATCH_POSITION,
        previousUpperRoundMatchPosition: (generateMatchPosition(match, currentRelation.previousRoundMatchFactor) -
          doubleUpperMatchCountShift) as BracketMatchPosition,
        previousLowerRoundMatchPosition: generateMatchPosition(match, currentRelation.previousRoundMatchFactor),
      };
    }
    case 'one-to-one': {
      const previousRoundHasDoubleTheMatchCount = currentRelation.previousRoundMatchFactor === 2;
      const doubleUpperMatchCountShift = previousRoundHasDoubleTheMatchCount ? 1 : 0;

      return {
        nextRoundMatchPosition: generateMatchPosition(match, currentRelation.nextRoundMatchFactor),
        previousUpperRoundMatchPosition: (generateMatchPosition(match, currentRelation.previousRoundMatchFactor) -
          doubleUpperMatchCountShift) as BracketMatchPosition,
        previousLowerRoundMatchPosition: generateMatchPosition(match, currentRelation.previousRoundMatchFactor),
      };
    }
    case 'two-to-one': {
      return {
        nextRoundMatchPosition: generateMatchPosition(match, currentRelation.nextRoundMatchFactor),
        previousUpperRoundMatchPosition: generateMatchPosition(match, currentRelation.previousUpperRoundMatchFactor),
        previousLowerRoundMatchPosition: generateMatchPosition(match, currentRelation.previousLowerRoundMatchFactor),
      };
    }
    case 'two-to-nothing': {
      return {
        nextRoundMatchPosition: FALLBACK_MATCH_POSITION,
        previousUpperRoundMatchPosition: generateMatchPosition(match, currentRelation.previousUpperRoundMatchFactor),
        previousLowerRoundMatchPosition: generateMatchPosition(match, currentRelation.previousLowerRoundMatchFactor),
      };
    }
  }
};

export const generateMatchPosition = (match: BracketMatch<unknown, unknown>, factor: MatchFactor) => {
  return Math.ceil(match.position * factor) as BracketMatchPosition;
};

export const logRoundRelations = (
  roundRelations: BracketRoundRelations<unknown, unknown>,
  bracketData: BracketData<unknown, unknown>,
) => {
  for (const [roundId, relation] of roundRelations.entries()) {
    const round = bracketData.rounds.get(roundId);

    if (!round) {
      console.error(`Round with id ${roundId} not found in bracket data. The bracket will be malformed.`);
      continue;
    }

    switch (relation.type) {
      case 'nothing-to-one':
        console.log(`START: ${round.name} -> ${relation.nextRound.name} (F: ${relation.nextRoundMatchFactor})`);
        break;
      case 'one-to-nothing':
        console.log(
          `${relation.previousRound.name} (F: ${relation.previousRoundMatchFactor}) <- ENDING: ${round.name}`,
        );
        break;
      case 'one-to-one':
        console.log(
          `${relation.previousRound.name} (F: ${relation.previousRoundMatchFactor}) <- ${round.name} -> ${relation.nextRound.name} (F: ${relation.nextRoundMatchFactor})`,
        );
        break;
      case 'two-to-one':
        console.log(
          `MERGER: ${relation.previousUpperRound.name} (F: ${relation.previousUpperRoundMatchFactor}) AND ${relation.previousLowerRound.name} (F: ${relation.previousLowerRoundMatchFactor}) <- ${round.name} -> ${relation.nextRound.name} (F: ${relation.nextRoundMatchFactor})`,
        );
        break;
      case 'two-to-nothing':
        console.log(
          `MERGER: ${relation.previousUpperRound.name} (F: ${relation.previousUpperRoundMatchFactor}) AND ${relation.previousLowerRound.name} (F: ${relation.previousLowerRoundMatchFactor}) <- ENDING: ${round.name}`,
        );
        break;
    }
  }
};

export const generateMatchParticipantMap = <TRoundData, TMatchData>(
  bracketData: BracketData<TRoundData, TMatchData>,
) => {
  const matchParticipantMap: MatchParticipantMap<TRoundData, TMatchData> = new Map();

  const hasElimination =
    bracketData.mode === TOURNAMENT_MODE.SINGLE_ELIMINATION ||
    bracketData.mode === TOURNAMENT_MODE.DOUBLE_ELIMINATION ||
    bracketData.mode === TOURNAMENT_MODE.SWISS_WITH_ELIMINATION;

  for (const participant of bracketData.participants.values()) {
    let winsTilNow = 0;
    let lossesTilNow = 0;
    let tiesTilNow = 0;

    for (const matchParticipantMatch of participant.matches.values()) {
      const isWinner = matchParticipantMatch.bracketMatch.winner === matchParticipantMatch.side;
      const isLooser =
        matchParticipantMatch.bracketMatch.winner &&
        matchParticipantMatch.bracketMatch.winner !== matchParticipantMatch.side;
      const isTie =
        matchParticipantMatch.bracketMatch.status === 'completed' && !matchParticipantMatch.bracketMatch.winner;

      if (isWinner) {
        winsTilNow++;
      } else if (isLooser) {
        lossesTilNow++;
      } else if (isTie) {
        tiesTilNow++;
      }

      let isEliminated = false;
      let isEliminationMatch = false;

      if (hasElimination) {
        // TODO: Implement elimination logic

        // Means the current match is loss and it's the last match of the participant
        isEliminated = false;

        // Always true for single elimination, never for e.g. groups, depends on the round for double elimination, depends on the loss count for swiss with elimination
        isEliminationMatch = false;
      }

      // TODO: Implement round logic
      // true if its the first round of the bracket
      const isFirstRound = false;

      // true if its the last round of the bracket (eg. final for single elimination)
      const isLastRound = false;

      const participantMatchData: MatchParticipantMatch<TRoundData, TMatchData> = {
        bracketMatch: matchParticipantMatch.bracketMatch,
        result: isWinner ? 'win' : isLooser ? 'loss' : isTie ? 'tie' : null,
        isEliminated,
        isEliminationMatch,
        isFirstRound,
        isLastRound,
        tieCount: tiesTilNow,
        winCount: winsTilNow,
        lossCount: lossesTilNow,
      };

      if (!matchParticipantMap.has(participant.id)) {
        matchParticipantMap.set(participant.id, {
          id: participant.id,
          name: participant.name,
          matches: new Map(),
        });
      }

      const participantData = matchParticipantMap.get(participant.id) as MatchParticipant<TRoundData, TMatchData>;
      participantData.matches.set(matchParticipantMatch.bracketMatch.id, participantMatchData);
    }
  }

  return matchParticipantMap;
};

const factorialCache = new Map<number, number>();

export const getAvailableSwissGroupsForRound = (roundNumber: number, totalMatchesInRound: number) => {
  const ADVANCE_WINS = 3;
  const ELIMINATE_LOSSES = 3;

  // Cache factorial calculations
  const getFactorial = (n: number): number => {
    if (n <= 1) return 1;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    if (factorialCache.has(n)) return factorialCache.get(n)!;

    const result = n * getFactorial(n - 1);
    factorialCache.set(n, result);
    return result;
  };

  // Pre-calculate roundFactorial
  const roundFact = getFactorial(roundNumber);

  let totalCombinations = 0;
  const validGroups: { wins: number; losses: number; combinations: number }[] = [];

  // Single loop to gather valid groups and total combinations
  for (let wins = roundNumber; wins >= 0; wins--) {
    const losses = roundNumber - wins;
    const remainingGames = ADVANCE_WINS + ELIMINATE_LOSSES - (wins + losses) - 1;
    const notYetEliminated = losses < ELIMINATE_LOSSES;
    const canStillAdvance = wins < ADVANCE_WINS && remainingGames >= 0;

    if (!canStillAdvance || !notYetEliminated) continue;

    const combinations = roundFact / (getFactorial(wins) * getFactorial(losses));
    totalCombinations += combinations;
    validGroups.push({ wins, losses, combinations });
  }

  // Create final groups with calculated proportions
  return validGroups.map(({ wins, losses, combinations }) => ({
    id: `${wins}-${losses}` as BracketRoundSwissGroupId,
    name: `${wins}-${losses}`,
    matchesInGroup: Math.round((combinations / totalCombinations) * totalMatchesInRound),
  }));
};

export const generateBracketRoundSwissGroupMaps = <TRoundData, TMatchData>(
  bracketData: BracketData<TRoundData, TMatchData>,
  matchParticipantMap: MatchParticipantMap<TRoundData, TMatchData>,
) => {
  if (bracketData.mode !== TOURNAMENT_MODE.SWISS_WITH_ELIMINATION) {
    return null;
  }

  const roundsWithSwissGroups: BracketRoundMapWithSwissData<TRoundData, TMatchData> = new Map();

  let roundNumber = 0;
  for (const bracketRound of bracketData.rounds.values()) {
    const availableGroups = getAvailableSwissGroupsForRound(roundNumber, bracketRound.matchCount);

    const roundSwissData: BracketRoundSwissData<TRoundData, TMatchData> = {
      groups: new Map(),
    };

    for (const group of availableGroups) {
      const subGroup: BracketRoundSwissGroup<TRoundData, TMatchData> = {
        id: group.id,
        name: group.name,
        matches: new Map(),
        allowedMatchCount: group.matchesInGroup,
      };

      roundSwissData.groups.set(group.id, subGroup);
    }

    const emptyMatchIds: BracketMatchId[] = [];

    for (const match of bracketRound.matches.values()) {
      const participantHome = match.home ? (matchParticipantMap.get(match.home) ?? null) : null;
      const participantAway = match.away ? (matchParticipantMap.get(match.away) ?? null) : null;

      const anyParticipant = participantHome || participantAway;

      if (!anyParticipant) {
        emptyMatchIds.push(match.id);
        continue;
      }

      const matchParticipantMatch = anyParticipant.matches.get(match.id);

      if (!matchParticipantMatch) throw new Error('Match participant match not found');

      const wins = matchParticipantMatch.winCount;
      const losses = matchParticipantMatch.lossCount;

      const group = roundSwissData.groups.get(`${wins}-${losses}` as BracketRoundSwissGroupId);

      if (!group) throw new Error('Group not found for match: ' + match.id);

      group.matches.set(match.id, match);
    }

    for (const emptyMatchId of emptyMatchIds) {
      const match = bracketRound.matches.get(emptyMatchId);

      if (!match) throw new Error('Empty match not found');

      let groupFound = false;
      for (const group of roundSwissData.groups.values()) {
        if (group.matches.size < group.allowedMatchCount) {
          group.matches.set(match.id, match);
          groupFound = true;
          break;
        }
      }

      if (!groupFound) {
        throw new Error('No group found for empty match');
      }
    }

    roundNumber++;
  }

  return roundsWithSwissGroups;
};

export const generateBracketDataForEthlete = (source: RoundStageStructureWithMatchesView[]) => {
  const tournamentMode = generateTournamentModeFormEthleteRounds(source);

  const bracketData: BracketDataSource<RoundStageStructureView, MatchListViewUnion> = {
    rounds: [],
    matches: [],
    mode: tournamentMode,
  };

  for (const currentItem of source) {
    if (bracketData.rounds.some((r) => r.id === currentItem.round.id)) {
      throw new Error(`Round with id ${currentItem.round.id} already exists in the bracket data.`);
    }

    const roundType = generateRoundTypeFromEthleteRoundType(currentItem.round.type, tournamentMode);

    const bracketRound: BracketRoundSource<RoundStageStructureView> = {
      type: roundType,
      id: currentItem.round.id,
      data: currentItem.round,
      name: currentItem.round.name || currentItem.round.type,
    };

    bracketData.rounds.push(bracketRound);

    for (const match of currentItem.matches) {
      if (bracketData.matches.some((m) => m.id === match.id)) {
        throw new Error(`Match with id ${match.id} already exists in the bracket data.`);
      }

      const bracketMatch: BracketMatchSource<MatchListViewUnion> = {
        id: match.id,
        data: match,
        roundId: currentItem.round.id,
        home: match.home?.id || null,
        away: match.away?.id || null,
        winner: match.winningSide,
        status: match.status === 'published' ? 'completed' : 'pending',
      };

      bracketData.matches.push(bracketMatch);
    }
  }

  return bracketData;
};

type GenerateBracketMatchOptions<TRoundData, TMatchData> = {
  bracketData: BracketData<TRoundData, TMatchData>;
  bracketRound: BracketRound<TRoundData, TMatchData>;
  currentIndexInRound: number;
};

const generateAndSetBracketMatchWithParticipants = <TRoundData, TMatchData>(
  match: BracketMatchSource<TMatchData>,
  options: GenerateBracketMatchOptions<TRoundData, TMatchData>,
) => {
  const matchId = match.id as BracketMatchId;
  const { bracketData, bracketRound, currentIndexInRound } = options;

  const bracketMatch: BracketMatch<TRoundData, TMatchData> = {
    id: matchId,
    indexInRound: currentIndexInRound,
    position: (currentIndexInRound + 1) as BracketMatchPosition,
    data: match.data,
    round: bracketRound,
    home: match.home as MatchParticipantId | null,
    away: match.away as MatchParticipantId | null,
    winner: match.winner,
    status: match.status,
  };

  bracketData.matches.set(matchId, bracketMatch);
  bracketRound.matches.set(matchId, bracketMatch);

  const participants = [bracketMatch.home, bracketMatch.away];

  for (const [participantIndex, participant] of participants.entries()) {
    if (!participant) continue;

    const side = participantIndex === 0 ? 'Homeside' : 'Awayside';

    if (!bracketData.participants.has(participant)) {
      bracketData.participants.set(participant, {
        id: participant,
        name: `${side} ${currentIndexInRound}`,
        matches: new Map(),
      });
    }

    const participantData = bracketData.participants.get(participant) as BracketParticipant<TRoundData, TMatchData>;

    if (!participantData.matches.has(bracketMatch.id)) {
      participantData.matches.set(bracketMatch.id, {
        side: bracketMatch.home === participant ? 'home' : 'away',
        bracketMatch,
      });
    }
  }

  return bracketMatch;
};

export type GenerateBracketDataOptions = {
  layout: BracketDataLayout;
};

export const generateBracketData = <TRoundData, TMatchData>(
  source: BracketDataSource<TRoundData, TMatchData>,
  options: GenerateBracketDataOptions,
) => {
  if (!canRenderLayoutInTournamentMode(options.layout, source.mode)) {
    throw new Error(`Cannot render layout ${options.layout} in mode ${source.mode}`);
  }

  const shouldSplitRoundsInTwo = options.layout === BRACKET_DATA_LAYOUT.MIRRORED;

  const bracketData: BracketData<TRoundData, TMatchData> = {
    matches: new Map(),
    mode: source.mode,
    participants: new Map(),
    rounds: new Map(),
    roundIds: [],
    matchIds: [],
  };

  let currentUpperBracketIndex = 0;
  let currentLowerBracketIndex = 0;

  const splitRoundsRest: BracketRound<TRoundData, TMatchData>[] = [];

  for (const [roundIndex, round] of source.rounds.entries()) {
    const isLowerBracket = round.type === DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.LOWER_BRACKET;
    const matches = source.matches.filter((m) => m.roundId === round.id);
    const roundId = round.id as BracketRoundId;
    const shouldSplitRound = shouldSplitRoundsInTwo && matches.length % 2 === 0;
    const isFirstRound = roundIndex === 0;

    if (shouldSplitRound) {
      const firstHalfMatchesMaxIndex = matches.length / 2 - 1;

      const firstHalfRoundId = `${roundId}--half-1` as BracketRoundId;
      const secondHalfRoundId = `${roundId}--half-2` as BracketRoundId;

      const bracketRoundFirstHalf: BracketRound<TRoundData, TMatchData> = {
        type: round.type,
        id: firstHalfRoundId,
        index: isLowerBracket ? currentLowerBracketIndex : currentUpperBracketIndex,
        data: round.data,
        position: ((isLowerBracket ? currentLowerBracketIndex : currentUpperBracketIndex) + 1) as BracketRoundPosition,
        name: round.name,
        matchCount: matches.length / 2,
        matches: new Map(),
        mirrorRoundType: BRACKET_ROUND_MIRROR_TYPE.LEFT,
        isFirstRound,
      };

      const bracketRoundSecondHalf: BracketRound<TRoundData, TMatchData> = {
        type: round.type,
        id: secondHalfRoundId,
        index: -1,
        data: round.data,
        position: -1 as BracketRoundPosition,
        name: round.name,
        matchCount: matches.length / 2,
        matches: new Map(),
        mirrorRoundType: BRACKET_ROUND_MIRROR_TYPE.RIGHT,
        isFirstRound,
      };

      bracketData.roundIds.push(firstHalfRoundId);
      bracketData.rounds.set(firstHalfRoundId, bracketRoundFirstHalf);
      splitRoundsRest.unshift(bracketRoundSecondHalf);

      for (let index = 0; index <= firstHalfMatchesMaxIndex; index++) {
        const matchFirst = matches[index];
        const matchSecond = matches[firstHalfMatchesMaxIndex + 1 + index];

        if (!matchFirst || !matchSecond) throw new Error('Match not found');

        const bracketMatchFirst = generateAndSetBracketMatchWithParticipants(matchFirst, {
          bracketData,
          bracketRound: bracketRoundFirstHalf,
          currentIndexInRound: index,
        });
        const bracketMatchSecond = generateAndSetBracketMatchWithParticipants(matchSecond, {
          bracketData,
          bracketRound: bracketRoundSecondHalf,
          currentIndexInRound: index,
        });

        bracketData.matchIds.push(bracketMatchFirst.id, bracketMatchSecond.id);
      }
    } else {
      const bracketRound: BracketRound<TRoundData, TMatchData> = {
        type: round.type,
        id: roundId,
        index: isLowerBracket ? currentLowerBracketIndex : currentUpperBracketIndex,
        data: round.data,
        position: ((isLowerBracket ? currentLowerBracketIndex : currentUpperBracketIndex) + 1) as BracketRoundPosition,
        name: round.name,
        matchCount: matches.length,
        matches: new Map(),
        mirrorRoundType: null,
        isFirstRound,
      };

      bracketData.roundIds.push(roundId);
      bracketData.rounds.set(roundId, bracketRound);

      let currentIndexInRound = 0;

      for (const match of matches) {
        const bracketMatch = generateAndSetBracketMatchWithParticipants(match, {
          bracketData,
          bracketRound,
          currentIndexInRound,
        });
        bracketData.matchIds.push(bracketMatch.id);
        currentIndexInRound++;
      }
    }

    if (isLowerBracket) {
      currentLowerBracketIndex++;
    } else {
      currentUpperBracketIndex++;
    }
  }

  if (splitRoundsRest.length) {
    const lastRoundId = bracketData.roundIds[bracketData.roundIds.length - 1];

    if (!lastRoundId) throw new Error('Last round id not found');

    const lastRound = bracketData.rounds.get(lastRoundId);

    if (!lastRound) throw new Error('Last round not found');

    for (const [splitRoundIndex, splitRound] of splitRoundsRest.entries()) {
      splitRound.index = lastRound.index + splitRoundIndex + 1;
      splitRound.position = (lastRound.position + splitRoundIndex + 1) as BracketRoundPosition;
      bracketData.rounds.set(splitRound.id, splitRound);
      bracketData.roundIds.push(splitRound.id);
    }
  }

  return bracketData;
};
