import {
  BracketMap,
  BracketMatchId,
  BracketRoundId,
  BracketRoundType,
  createNewBracketBase,
  GenerateBracketDataOptions,
  MatchParticipantId,
  NewBracketMatchBase,
  NewBracketMatchParticipantBase,
  NewBracketParticipantBase,
  NewBracketRoundBase,
  TournamentMode,
} from '../core';
import { BracketDataSource } from '../integrations';
import { BracketMatchRelation, generateMatchRelationsNew } from './match-relations';
import { BracketRoundRelation, generateRoundRelationsNew } from './round-relations';

export type NewBracket<TRoundData, TMatchData> = {
  rounds: BracketMap<BracketRoundId, NewBracketRound<TRoundData, TMatchData>>;
  roundsByType: BracketMap<BracketRoundType, BracketMap<BracketRoundId, NewBracketRound<TRoundData, TMatchData>>>;
  matches: BracketMap<BracketMatchId, NewBracketMatch<TRoundData, TMatchData>>;
  participants: BracketMap<MatchParticipantId, NewBracketParticipant<TRoundData, TMatchData>>;
  mode: TournamentMode;
};

export type NewBracketRound<TRoundData, TMatchData> = NewBracketRoundBase<TRoundData> & {
  matches: BracketMap<BracketMatchId, NewBracketMatch<TRoundData, TMatchData>>;
  relation: BracketRoundRelation<TRoundData, TMatchData>;
};

export type NewBracketMatch<TRoundData, TMatchData> = NewBracketMatchBase<TMatchData> & {
  round: NewBracketRound<TRoundData, TMatchData>;
  home: NewBracketMatchParticipant<TRoundData, TMatchData> | null;
  away: NewBracketMatchParticipant<TRoundData, TMatchData> | null;
  winner: NewBracketMatchParticipant<TRoundData, TMatchData> | null;
  relation: BracketMatchRelation<TRoundData, TMatchData>;
};

export type NewBracketParticipantMatch<TRoundData, TMatchData> = NewBracketMatch<TRoundData, TMatchData> & {
  me: NewBracketMatchParticipant<TRoundData, TMatchData>;
  opponent: NewBracketMatchParticipant<TRoundData, TMatchData> | null;
};

export type NewBracketParticipant<TRoundData, TMatchData> = NewBracketParticipantBase & {
  matches: BracketMap<BracketMatchId, NewBracketParticipantMatch<TRoundData, TMatchData>>;
};

export type NewBracketMatchParticipant<TRoundData, TMatchData> = NewBracketMatchParticipantBase & {
  matches: BracketMap<BracketMatchId, NewBracketMatch<TRoundData, TMatchData>>;
};

export const createNewBracket = <TRoundData, TMatchData>(
  source: BracketDataSource<TRoundData, TMatchData>,
  options: GenerateBracketDataOptions,
) => {
  const bracketNewBase = createNewBracketBase(source, options);

  const newBracket: NewBracket<TRoundData, TMatchData> = {
    matches: new BracketMap(),
    participants: new BracketMap(),
    rounds: new BracketMap(),
    roundsByType: new BracketMap(),
    mode: bracketNewBase.mode,
  };

  for (const roundBase of bracketNewBase.rounds.values()) {
    const newRound: NewBracketRound<TRoundData, TMatchData> = {
      ...roundBase,
      matches: new BracketMap(),
      relation: {
        type: 'dummy',
      } as unknown as BracketRoundRelation<TRoundData, TMatchData>,
    };

    newBracket.rounds.set(roundBase.id, newRound);

    if (!newBracket.roundsByType.has(roundBase.type)) {
      newBracket.roundsByType.set(roundBase.type, new BracketMap());
    }

    newBracket.roundsByType.getOrThrow(roundBase.type).set(roundBase.id, newRound);
  }

  for (const participantBase of bracketNewBase.participants.values()) {
    const newParticipant: NewBracketParticipant<TRoundData, TMatchData> = {
      ...participantBase,
      matches: new BracketMap(),
    };

    newBracket.participants.set(participantBase.id, newParticipant);
  }

  for (const matchBase of bracketNewBase.matches.values()) {
    const round = newBracket.rounds.getOrThrow(matchBase.roundId as BracketRoundId);

    const newMatch: NewBracketMatch<TRoundData, TMatchData> = {
      ...matchBase,
      home: null,
      away: null,
      winner: null,
      round,
      relation: {
        type: 'dummy',
      } as unknown as BracketMatchRelation<TRoundData, TMatchData>,
    };

    const homeParticipant = matchBase.home
      ? {
          ...matchBase.home,
          matches: new BracketMap<BracketMatchId, NewBracketMatch<TRoundData, TMatchData>>(),
        }
      : null;

    const awayParticipant = matchBase.away
      ? {
          ...matchBase.away,
          matches: new BracketMap<BracketMatchId, NewBracketMatch<TRoundData, TMatchData>>(),
        }
      : null;

    newMatch.home = homeParticipant;
    newMatch.away = awayParticipant;

    if (homeParticipant) {
      const participantBase = newBracket.participants.getOrThrow(homeParticipant.id);

      const participantMatch: NewBracketParticipantMatch<TRoundData, TMatchData> = {
        ...newMatch,
        me: homeParticipant,
        opponent: awayParticipant,
      };

      participantBase.matches.set(matchBase.id, participantMatch);
    }

    if (awayParticipant) {
      const participantBase = newBracket.participants.getOrThrow(awayParticipant.id);

      const participantMatch: NewBracketParticipantMatch<TRoundData, TMatchData> = {
        ...newMatch,
        me: awayParticipant,
        opponent: homeParticipant,
      };

      participantBase.matches.set(matchBase.id, participantMatch);
    }

    if (matchBase.winner) {
      const winnerParticipant = homeParticipant?.id === matchBase.winner.id ? homeParticipant : awayParticipant;

      if (!winnerParticipant)
        throw new Error(`Winner participant with id ${matchBase.winner.id} not found in match base`);

      newMatch.winner = winnerParticipant;
    }

    newBracket.matches.set(matchBase.id, newMatch);
    round.matches.set(matchBase.id, newMatch);
  }

  for (const participant of newBracket.participants.values()) {
    for (const match of participant.matches.values()) {
      if (match.home?.id === participant.id) {
        match.home.matches = participant.matches;
      } else if (match.away?.id === participant.id) {
        match.away.matches = participant.matches;
      }

      if (match.winner?.id === participant.id) {
        match.winner.matches = participant.matches;
      }
    }
  }

  const roundRelations = generateRoundRelationsNew(newBracket);

  for (const roundRelation of roundRelations) {
    roundRelation.currentRound.relation = roundRelation;
  }

  const matchRelations = generateMatchRelationsNew(newBracket);

  for (const matchRelation of matchRelations) {
    matchRelation.currentMatch.relation = matchRelation;
  }

  return newBracket;
};
