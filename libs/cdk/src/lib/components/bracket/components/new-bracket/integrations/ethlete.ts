import {
  MatchListViewUnion,
  RoundStageStructureView,
  RoundStageStructureWithMatchesView,
  RoundType,
} from '@ethlete/types';
import {
  BracketRoundType,
  COMMON_BRACKET_ROUND_TYPE,
  DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE,
  SINGLE_ELIMINATION_BRACKET_ROUND_TYPE,
  SWISS_BRACKET_ROUND_TYPE,
  TOURNAMENT_MODE,
  TournamentMode,
} from '../core';
import { BracketDataSource, BracketMatchSource, BracketRoundSource } from './base';

export const generateRoundTypeFromEthleteRoundType = (
  type: RoundType,
  tournamentMode: TournamentMode,
  roundMatchCount: number,
): BracketRoundType => {
  switch (type) {
    case 'normal':
      switch (tournamentMode) {
        case 'single-elimination':
          // This might break if the single elimination contains a 3rd place match + round
          if (roundMatchCount === 1) {
            return COMMON_BRACKET_ROUND_TYPE.FINAL;
          } else {
            return SINGLE_ELIMINATION_BRACKET_ROUND_TYPE.SINGLE_ELIMINATION_BRACKET;
          }
        case 'swiss-with-elimination':
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
    case 'fifa_swiss': {
      const lastRound = source[source.length - 1];

      if (!lastRound) throw new Error('No last round found');

      if (lastRound.matches.length !== firstRound.matches.length) {
        return TOURNAMENT_MODE.SWISS_WITH_ELIMINATION;
      } else {
        throw new Error('Unsupported tournament mode: swiss without elimination');
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

    const roundType = generateRoundTypeFromEthleteRoundType(
      currentItem.round.type,
      tournamentMode,
      currentItem.matches.length,
    );

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
