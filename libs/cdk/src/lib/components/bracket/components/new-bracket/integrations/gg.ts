import { OpponentSide } from '@ethlete/types';
import { GgData } from '../../../stories/dummy-data';
import {
  BracketRoundType,
  COMMON_BRACKET_ROUND_TYPE,
  DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE,
  SINGLE_ELIMINATION_BRACKET_ROUND_TYPE,
  TOURNAMENT_MODE,
  TournamentMode,
} from '../core';
import { BracketDataSource, BracketMatchSource, BracketRoundSource } from './base';

export const generateTournamentModeFormGgData = (source: GgData): TournamentMode => {
  switch (source.mode) {
    // case 'groups':
    //   return TOURNAMENT_MODE.GROUP;
    // case 'fifa_swiss': {
    //   const lastRound = source[source.length - 1];

    //   if (!lastRound) throw new Error('No last round found');

    //   if (lastRound.matches.length !== firstRound.matches.length) {
    //     return TOURNAMENT_MODE.SWISS_WITH_ELIMINATION;
    //   } else {
    //     return TOURNAMENT_MODE.SWISS;
    //   }
    // }
    case 'double-elimination':
      return TOURNAMENT_MODE.DOUBLE_ELIMINATION;
    case 'single-elimination':
      return TOURNAMENT_MODE.SINGLE_ELIMINATION;
    default:
      throw new Error(`Unsupported tournament mode: ${source.mode}`);
  }
};

export const generateRoundTypeFromGgMatch = (
  tournamentMode: TournamentMode,
  bracketType: string | null, // 'winner' | 'looser' | null,
  stageNumber: number,
  matchCount: number,
): BracketRoundType => {
  switch (tournamentMode) {
    case 'double-elimination': {
      switch (stageNumber) {
        case 1: {
          switch (bracketType) {
            case 'winner':
              return DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.UPPER_BRACKET;
            case 'looser':
              return DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.LOWER_BRACKET;
            default:
              throw new Error(`Unsupported bracket type: ${bracketType}`);
          }
        }
        case 2: {
          return COMMON_BRACKET_ROUND_TYPE.FINAL;
        }
        case 3: {
          return DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.REVERSE_FINAL;
        }
        default: {
          throw new Error(`Unsupported stage number: ${stageNumber}`);
        }
      }
    }
    case 'single-elimination': {
      if (matchCount === 1) {
        return COMMON_BRACKET_ROUND_TYPE.FINAL;
      } else {
        return SINGLE_ELIMINATION_BRACKET_ROUND_TYPE.SINGLE_ELIMINATION_BRACKET;
      }
    }
    default: {
      throw new Error(`Unsupported tournament mode: ${tournamentMode}`);
    }
  }
};

export const generateBracketDataForGg = (source: GgData) => {
  // roundNumber-stageNumber-bracketType
  type GgMatchRoundId = `${number}-${number}-${string | null}`;

  const tournamentMode = generateTournamentModeFormGgData(source);

  const bracketData: BracketDataSource<null, GgData['matches'][number]> = {
    rounds: [],
    matches: [],
    mode: tournamentMode,
  };

  const matchesGrouped: Map<GgMatchRoundId, GgData['matches']> = new Map();

  for (const match of source.matches) {
    const roundId = `${match.roundNumber}-${match.stageNumber}-${match.bracketType || null}` as GgMatchRoundId;

    if (!matchesGrouped.has(roundId)) {
      matchesGrouped.set(roundId, []);
    }

    matchesGrouped.get(roundId)?.push(match);
  }

  for (const [roundId, matches] of matchesGrouped.entries()) {
    const firstMatch = matches[0];

    if (!firstMatch) throw new Error('First match not found');

    const roundType = generateRoundTypeFromGgMatch(
      tournamentMode,
      firstMatch.bracketType,
      firstMatch.stageNumber,
      matches.length,
    );

    const bracketRound: BracketRoundSource<null> = {
      type: roundType,
      id: roundId,
      data: null,
      name: firstMatch.roundTitle,
    };

    bracketData.rounds.push(bracketRound);

    for (const match of matches) {
      const bracketMatch: BracketMatchSource<GgData['matches'][number]> = {
        id: match.id,
        data: match,
        roundId: roundId,
        home: match.homeMatchSide.participant?.id || null,
        away: match.awayMatchSide.participant?.id || null,
        winner: match.winningSide as OpponentSide | null,
        status: match.status === 'completed' ? 'completed' : 'pending',
      };

      bracketData.matches.push(bracketMatch);
    }
  }

  return bracketData;
};
