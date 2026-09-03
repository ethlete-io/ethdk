import { BracketDataSource } from '../integrations';
import { GenerateBracketDataOptions } from './bracket';
import { BracketMap } from './bracket-map';
import { BRACKET_DATA_LAYOUT } from './layout';
import { BracketMatchId } from './match';
import { TOURNAMENT_MODE } from './tournament';
import { BracketRuntimeError } from '../bracket-runtime-error';
import { BRACKET_ERROR_CODES } from '../bracket-errors';

export type BracketRoundId = string & { _brand: 'BracketRoundId' };
export type BracketRoundShortId = string & { _brand: 'BracketRoundShortId' };
export type BracketRoundPosition = number & { _brand: 'BracketRoundPosition' };
export type BracketRoundMirrorType = (typeof BRACKET_ROUND_MIRROR_TYPE)[keyof typeof BRACKET_ROUND_MIRROR_TYPE];

export const BRACKET_ROUND_MIRROR_TYPE = {
  LEFT: 'left',
  RIGHT: 'right',
} as const;

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
  SingleEliminationBracketRoundType | DoubleEliminationBracketRoundType | SwissBracketRoundType | GroupBracketRoundType;

export type BracketRoundBase<TRoundData> = {
  /**
   * How deep this round sits in its own bracket - 0 for the opening round, counted separately for the
   * upper and lower halves of a double elimination.
   *
   * **Both halves of a mirrored round share it.** That is what makes it the fold's coordinate: a
   * mirrored layout draws each depth twice, once on each side, so the depth is the only thing that says
   * which right-hand column belongs opposite which left-hand one.
   */
  logicalIndex: number;
  type: BracketRoundType;
  id: BracketRoundId;
  shortId: BracketRoundShortId;
  data: TRoundData;
  position: BracketRoundPosition;
  name: string;
  matchCount: number;
  mirrorRoundType: BracketRoundMirrorType | null;
  isFirstRound: boolean;
  isLastRound: boolean;
  isFirstOfType: boolean;
  isLastOfType: boolean;
};

export type BracketRoundWithRelationsBase<TRoundData> = BracketRoundBase<TRoundData> & {
  matchIds: BracketMatchId[];
};

export const createRoundsMapBase = <TRoundData, TMatchData>(
  source: BracketDataSource<TRoundData, TMatchData>,
  options: GenerateBracketDataOptions,
) => {
  const map = new BracketMap<BracketRoundId, BracketRoundWithRelationsBase<TRoundData>>();

  const shouldSplitRoundsInTwo = options.layout === BRACKET_DATA_LAYOUT.MIRRORED;
  const isDoubleElimination = source.mode === TOURNAMENT_MODE.DOUBLE_ELIMINATION;

  let currentUpperBracketIndex = 0;
  let currentLowerBracketIndex = 0;

  const splitRoundsRest: BracketRoundWithRelationsBase<TRoundData>[] = [];

  const terminalRoundSortPriority: Partial<Record<string, number>> = {
    [COMMON_BRACKET_ROUND_TYPE.FINAL]: 1,
    [DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.REVERSE_FINAL]: 2,
    [COMMON_BRACKET_ROUND_TYPE.THIRD_PLACE]: 3,
  };

  const orderedRounds = [...source.rounds].sort(
    (a, b) => (terminalRoundSortPriority[a.type] ?? 0) - (terminalRoundSortPriority[b.type] ?? 0),
  );

  for (const [roundIndex, round] of orderedRounds.entries()) {
    const isUpperBracket = round.type === DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.UPPER_BRACKET;
    const isLowerBracket = round.type === DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.LOWER_BRACKET;
    const isCommonDoubleEliminationRound = !isUpperBracket && !isLowerBracket && isDoubleElimination;

    const matches = source.matches.filter((m) => m.roundId === round.id);
    const roundId = round.id as BracketRoundId;
    // An odd match count cannot be halved, so the round stays whole and lands in the middle of the fold.
    // That is why a mirrored bracket converges on its late rounds without anything having to say so:
    // those are the rounds down to one match.
    const shouldSplitRound = shouldSplitRoundsInTwo && matches.length % 2 === 0;
    const isFirstRound = roundIndex === 0;
    const isLastRound = roundIndex === orderedRounds.length - 1;

    const isFirstOfType = orderedRounds.findIndex((r) => r.type === round.type) === roundIndex;
    const isLastOfType =
      orderedRounds
        .slice()
        .reverse()
        .findIndex((r) => r.type === round.type) ===
      orderedRounds.length - roundIndex - 1;

    const depth =
      isLowerBracket || isCommonDoubleEliminationRound ? currentLowerBracketIndex : currentUpperBracketIndex;

    if (shouldSplitRound) {
      const firstHalfRoundId = `${roundId}--half-1` as BracketRoundId;
      const secondHalfRoundId = `${roundId}--half-2` as BracketRoundId;
      const firstHalfMatchesMaxIndex = matches.length / 2 - 1;

      // Both halves are the same round at the same depth, drawn on either side of the fold - so they
      // carry the same `logicalIndex`, which is what pairs a right-hand column with its left-hand twin.
      const halfBase = {
        type: round.type,
        logicalIndex: depth,
        data: round.data,
        position: (depth + 1) as BracketRoundPosition,
        name: round.name,
        matchCount: matches.length / 2,
        isFirstRound,
        isLastRound,
        isFirstOfType,
        isLastOfType,
      };

      const bracketRoundFirstHalf: BracketRoundWithRelationsBase<TRoundData> = {
        ...halfBase,
        id: firstHalfRoundId,
        shortId: `${roundIndex}-left` as BracketRoundShortId,
        matchIds: matches.slice(0, firstHalfMatchesMaxIndex + 1).map((m) => m.id as BracketMatchId),
        mirrorRoundType: BRACKET_ROUND_MIRROR_TYPE.LEFT,
      };

      const bracketRoundSecondHalf: BracketRoundWithRelationsBase<TRoundData> = {
        ...halfBase,
        id: secondHalfRoundId,
        shortId: `${roundIndex}-right` as BracketRoundShortId,
        matchIds: matches.slice(firstHalfMatchesMaxIndex + 1).map((m) => m.id as BracketMatchId),
        mirrorRoundType: BRACKET_ROUND_MIRROR_TYPE.RIGHT,
      };

      map.set(firstHalfRoundId, bracketRoundFirstHalf);

      splitRoundsRest.unshift(bracketRoundSecondHalf);
    } else {
      const bracketRound: BracketRoundWithRelationsBase<TRoundData> = {
        type: round.type,
        id: roundId,
        shortId: `${roundIndex}` as BracketRoundShortId,
        logicalIndex: depth,
        data: round.data,
        position: (depth + 1) as BracketRoundPosition,
        name: round.name,
        matchCount: matches.length,
        matchIds: matches.map((m) => m.id as BracketMatchId),
        mirrorRoundType: null,
        isFirstRound,
        isLastRound,
        isFirstOfType,
        isLastOfType,
      };

      map.set(roundId, bracketRound);
    }

    if (isLowerBracket || isCommonDoubleEliminationRound) {
      currentLowerBracketIndex++;
    } else {
      currentUpperBracketIndex++;
    }
  }

  // The right halves close the map, deepest first, so walking it in order walks the fold: out along the
  // left side, through the rounds too small to halve, and back along the right. `splitRoundsRest` was
  // built by unshifting, so it is already in that order - and each half keeps the depth of its twin
  // rather than being renumbered past the last round, which is what lets a builder pair the two sides.
  if (splitRoundsRest.length) {
    if (!map.last()) throw new BracketRuntimeError(BRACKET_ERROR_CODES.ROUND_RELATION_INVALID, 'Last round not found');

    for (const splitRound of splitRoundsRest) {
      map.set(splitRound.id, splitRound);
    }
  }

  return map;
};
