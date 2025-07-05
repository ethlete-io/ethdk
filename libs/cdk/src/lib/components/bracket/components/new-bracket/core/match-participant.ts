import { BracketDataSource, BracketMatchSource } from '../integrations';
import { BracketMap } from './bracket-map';
import { BracketMatchId } from './match';
import { MatchParticipantId, NewBracketParticipantBase, NewBracketParticipantWithRelationsBase } from './participant';
import {
  BracketRoundId,
  COMMON_BRACKET_ROUND_TYPE,
  DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE,
  NewBracketRoundWithRelationsBase,
} from './round';
import { TOURNAMENT_MODE } from './tournament';

export type ParticipantMatchResult = 'win' | 'loss' | 'tie';
export type MatchParticipantSide = 'home' | 'away';

export type NewBracketMatchParticipantBase = NewBracketParticipantBase & {
  result: ParticipantMatchResult | null;
  isEliminated: boolean;
  isEliminationMatch: boolean;
  tieCount: number;
  winCount: number;
  lossCount: number;
  side: MatchParticipantSide;
};

export type NewBracketMatchParticipantWithRelationsBase = NewBracketMatchParticipantBase &
  NewBracketParticipantWithRelationsBase;

export const createNewMatchParticipantBase = <TRoundData, TMatchData>(
  source: BracketDataSource<TRoundData, TMatchData>,
  participantId: MatchParticipantId | null,
  match: BracketMatchSource<TMatchData>,
  rounds: BracketMap<BracketRoundId, NewBracketRoundWithRelationsBase<TRoundData>>,
  matchRoundId: BracketRoundId,
  participants: BracketMap<MatchParticipantId, NewBracketParticipantWithRelationsBase>,
) => {
  if (!participantId) return null;

  const participantBase = participants.getOrThrow(participantId);
  const roundBase = rounds.getOrThrow(matchRoundId as BracketRoundId);

  const matchIndex = participantBase.matchIds.indexOf(match.id as BracketMatchId);
  if (matchIndex === -1) throw new Error(`Match with id ${match.id} not found in participant with id ${participantId}`);

  const participantSide = match.home === participantId ? 'home' : 'away';
  const isWinner = match.winner === participantSide;
  const isLooser = match.winner && match.winner !== participantSide;
  const isTie = match.status === 'completed' && !match.winner;

  let winsTilNow = isWinner ? 1 : 0;
  let lossesTilNow = isLooser ? 1 : 0;
  let tiesTilNow = isTie ? 1 : 0;

  for (let i = 0; i < matchIndex; i++) {
    const previousMatchId = participantBase.matchIds[i];
    const previousMatch = source.matches.find((m) => m.id === previousMatchId);
    const myPreviousMatchSide =
      previousMatch?.home === participantId ? 'home' : previousMatch?.away === participantId ? 'away' : null;

    if (!previousMatch || !myPreviousMatchSide) continue;

    const previousIsWinner = previousMatch.winner === myPreviousMatchSide;
    const previousIsLooser = previousMatch.winner && previousMatch.winner !== myPreviousMatchSide;
    const previousIsTie = previousMatch.status === 'completed' && !previousMatch.winner;

    if (previousIsWinner) {
      winsTilNow++;
    } else if (previousIsLooser) {
      lossesTilNow++;
    } else if (previousIsTie) {
      tiesTilNow++;
    }
  }

  const hasElimination =
    source.mode === TOURNAMENT_MODE.SINGLE_ELIMINATION ||
    source.mode === TOURNAMENT_MODE.DOUBLE_ELIMINATION ||
    source.mode === TOURNAMENT_MODE.SWISS_WITH_ELIMINATION;

  // Means the current match is loss and it's the last match of the participant
  let isEliminated = false;

  // Always true for single elimination, never for e.g. groups, depends on the round for double elimination, depends on the loss count for swiss with elimination
  let isEliminationMatch = false;

  if (hasElimination) {
    switch (source.mode) {
      case TOURNAMENT_MODE.SINGLE_ELIMINATION: {
        isEliminationMatch = true;
        isEliminated = isLooser ?? false;
        break;
      }
      case TOURNAMENT_MODE.DOUBLE_ELIMINATION: {
        isEliminationMatch =
          roundBase.type === DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.LOWER_BRACKET ||
          roundBase.type === DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.REVERSE_FINAL ||
          roundBase.type === COMMON_BRACKET_ROUND_TYPE.THIRD_PLACE;

        // Final is only an elimination match if there is no reverse final or there is one and this participant came from the lower bracket
        if (roundBase.type === COMMON_BRACKET_ROUND_TYPE.FINAL) {
          const hasReverseFinal = source.rounds.some(
            (r) => r.type === DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.REVERSE_FINAL,
          );

          if (!hasReverseFinal) break;

          const currentMatchIndex = participantBase.matchIds.indexOf(match.id as BracketMatchId);

          if (currentMatchIndex === -1)
            throw new Error(`Match with id ${match.id} not found in participant with id ${participantId}`);

          if (currentMatchIndex === 0) break;

          const previousMatchIndex = currentMatchIndex - 1;
          const previousMatchId = participantBase.matchIds[previousMatchIndex];
          const previousMatch = source.matches.find((m) => m.id === previousMatchId);

          if (!previousMatch) throw new Error(`Previous match with id ${previousMatchId} not found`);

          const previousRound = rounds.getOrThrow(previousMatch.roundId as BracketRoundId);

          isEliminationMatch = previousRound.type === DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.LOWER_BRACKET;
        }

        isEliminated = (isEliminationMatch && isLooser) ?? false;
        break;
      }
      case TOURNAMENT_MODE.SWISS_WITH_ELIMINATION: {
        // In swiss you are eliminated after 3 losses, so we need to track the loss count
        isEliminationMatch = lossesTilNow >= 2;

        isEliminated = (isEliminationMatch && isLooser) ?? false;
      }
    }
  }

  const matchParticipantBase: NewBracketMatchParticipantWithRelationsBase = {
    ...participantBase,
    isEliminated,
    isEliminationMatch,
    lossCount: lossesTilNow,
    tieCount: tiesTilNow,
    winCount: winsTilNow,
    result: isWinner ? 'win' : isLooser ? 'loss' : isTie ? 'tie' : null,
    side: participantSide,
  };

  return matchParticipantBase;
};
