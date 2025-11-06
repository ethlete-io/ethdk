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

  const rounds = new BracketMap<BracketRoundId, NewBracketRound<TRoundData, TMatchData>>();
  const roundsByType = new BracketMap<
    BracketRoundType,
    BracketMap<BracketRoundId, NewBracketRound<TRoundData, TMatchData>>
  >();

  for (const roundBase of bracketNewBase.rounds.values()) {
    const newRound: NewBracketRound<TRoundData, TMatchData> = {
      ...roundBase,
      matches: new BracketMap(),
      relation: { type: 'dummy' } as unknown as BracketRoundRelation<TRoundData, TMatchData>,
    };
    rounds.set(roundBase.id, newRound);
    if (!roundsByType.has(roundBase.type)) {
      roundsByType.set(roundBase.type, new BracketMap());
    }
    roundsByType.getOrThrow(roundBase.type).set(roundBase.id, newRound);
  }

  const participants = new BracketMap<MatchParticipantId, NewBracketParticipant<TRoundData, TMatchData>>();

  for (const participantBase of bracketNewBase.participants.values()) {
    participants.set(participantBase.id, {
      ...participantBase,
      matches: new BracketMap(),
    });
  }

  const matches = new BracketMap<BracketMatchId, NewBracketMatch<TRoundData, TMatchData>>();

  for (const matchBase of bracketNewBase.matches.values()) {
    const round = rounds.getOrThrow(matchBase.roundId as BracketRoundId);

    const homeParticipant = matchBase.home
      ? { ...matchBase.home, matches: new BracketMap<BracketMatchId, NewBracketMatch<TRoundData, TMatchData>>() }
      : null;
    const awayParticipant = matchBase.away
      ? { ...matchBase.away, matches: new BracketMap<BracketMatchId, NewBracketMatch<TRoundData, TMatchData>>() }
      : null;

    const newMatch: NewBracketMatch<TRoundData, TMatchData> = {
      ...matchBase,
      home: homeParticipant,
      away: awayParticipant,
      winner: null,
      round,
      relation: { type: 'dummy' } as unknown as BracketMatchRelation<TRoundData, TMatchData>,
    };

    if (matchBase.winner) {
      const winnerParticipant = homeParticipant?.id === matchBase.winner.id ? homeParticipant : awayParticipant;
      if (!winnerParticipant)
        throw new Error(`Winner participant with id ${matchBase.winner.id} not found in match base`);
      newMatch.winner = winnerParticipant;
    }

    matches.set(matchBase.id, newMatch);
    round.matches.set(matchBase.id, newMatch);

    if (homeParticipant) {
      const participant = participants.getOrThrow(homeParticipant.id);
      participant.matches.set(matchBase.id, {
        ...newMatch,
        me: homeParticipant,
        opponent: awayParticipant,
      });
    }
    if (awayParticipant) {
      const participant = participants.getOrThrow(awayParticipant.id);
      participant.matches.set(matchBase.id, {
        ...newMatch,
        me: awayParticipant,
        opponent: homeParticipant,
      });
    }
  }

  for (const participant of participants.values()) {
    for (const match of participant.matches.values()) {
      if (match.home?.id === participant.id) match.home.matches = participant.matches;
      if (match.away?.id === participant.id) match.away.matches = participant.matches;
      if (match.winner?.id === participant.id) match.winner.matches = participant.matches;
    }
  }

  const newBracket: NewBracket<TRoundData, TMatchData> = {
    matches,
    participants,
    rounds,
    roundsByType,
    mode: bracketNewBase.mode,
  };

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
