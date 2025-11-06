import { BracketMatchPosition, BracketRoundId } from '../core';
import { NewBracket, NewBracketMatch, NewBracketRound } from './bracket';
import { BracketRoundRelation } from './round-relations';

const FALLBACK_MATCH_RELATION_POSITION = -1 as BracketMatchPosition;

// Will usually be 0.5, 1 or 2. In Swiss this value will be gibberish
export type BracketMatchFactor = number;

// One match has one previous match and one next match (this would be the case, if a group tournament is being displayed via a bracket)
export type BracketMatchRelationOneToOne<TRoundData, TMatchData> = {
  type: 'one-to-one';
  currentMatch: NewBracketMatch<TRoundData, TMatchData>;
  currentRound: NewBracketRound<TRoundData, TMatchData>;
  previousMatch: NewBracketMatch<TRoundData, TMatchData>;
  previousRound: NewBracketRound<TRoundData, TMatchData>;
  nextMatch: NewBracketMatch<TRoundData, TMatchData>;
  nextRound: NewBracketRound<TRoundData, TMatchData>;
};

// The match has no previous match but a single next match (eg. the start of the bracket)
export type BracketMatchRelationNothingToOne<TRoundData, TMatchData> = {
  type: 'nothing-to-one';
  currentMatch: NewBracketMatch<TRoundData, TMatchData>;
  currentRound: NewBracketRound<TRoundData, TMatchData>;
  nextMatch: NewBracketMatch<TRoundData, TMatchData>;
  nextRound: NewBracketRound<TRoundData, TMatchData>;
};

// The match has no next match but a single previous match (eg. reverse finals)
export type BracketMatchRelationOneToNothing<TRoundData, TMatchData> = {
  type: 'one-to-nothing';
  currentMatch: NewBracketMatch<TRoundData, TMatchData>;
  currentRound: NewBracketRound<TRoundData, TMatchData>;
  previousMatch: NewBracketMatch<TRoundData, TMatchData>;
  previousRound: NewBracketRound<TRoundData, TMatchData>;
};

// The match has two previous matches and one next match (eg. a normal match in the bracket that is neither the start nor the end)
export type BracketMatchRelationTwoToOne<TRoundData, TMatchData> = {
  type: 'two-to-one';
  currentMatch: NewBracketMatch<TRoundData, TMatchData>;
  currentRound: NewBracketRound<TRoundData, TMatchData>;
  previousUpperMatch: NewBracketMatch<TRoundData, TMatchData>;
  previousUpperRound: NewBracketRound<TRoundData, TMatchData>;
  previousLowerMatch: NewBracketMatch<TRoundData, TMatchData>;
  previousLowerRound: NewBracketRound<TRoundData, TMatchData>;
  nextMatch: NewBracketMatch<TRoundData, TMatchData>;
  nextRound: NewBracketRound<TRoundData, TMatchData>;
};

// The match has two previous matches and no next match (eg. the finals in a single elimination bracket)
export type BracketMatchRelationTwoToNothing<TRoundData, TMatchData> = {
  type: 'two-to-nothing';
  currentMatch: NewBracketMatch<TRoundData, TMatchData>;
  currentRound: NewBracketRound<TRoundData, TMatchData>;
  previousUpperMatch: NewBracketMatch<TRoundData, TMatchData>;
  previousUpperRound: NewBracketRound<TRoundData, TMatchData>;
  previousLowerMatch: NewBracketMatch<TRoundData, TMatchData>;
  previousLowerRound: NewBracketRound<TRoundData, TMatchData>;
};

export type BracketMatchRelation<TRoundData, TMatchData> =
  | BracketMatchRelationOneToOne<TRoundData, TMatchData>
  | BracketMatchRelationTwoToOne<TRoundData, TMatchData>
  | BracketMatchRelationNothingToOne<TRoundData, TMatchData>
  | BracketMatchRelationOneToNothing<TRoundData, TMatchData>
  | BracketMatchRelationTwoToNothing<TRoundData, TMatchData>;

export type MatchPositionMaps<TRoundData, TMatchData> = Map<
  BracketRoundId,
  Map<BracketMatchPosition, NewBracketMatch<TRoundData, TMatchData>>
>;

export const generateMatchPosition = (
  match: NewBracketMatch<unknown, unknown>,
  factor: BracketMatchFactor,
): BracketMatchPosition => Math.ceil(match.position * factor) as BracketMatchPosition;

export const generateMatchRelationPositions = <TRoundData, TMatchData>(
  relation: BracketRoundRelation<TRoundData, TMatchData>,
  match: NewBracketMatch<TRoundData, TMatchData>,
) => {
  switch (relation.type) {
    case 'nothing-to-one':
      return {
        nextRoundMatchPosition: generateMatchPosition(match, relation.nextRoundMatchFactor),
        previousUpperRoundMatchPosition: FALLBACK_MATCH_RELATION_POSITION,
        previousLowerRoundMatchPosition: FALLBACK_MATCH_RELATION_POSITION,
      };

    case 'one-to-nothing': {
      const double = relation.previousRoundMatchFactor === 2 ? 1 : 0;
      return {
        nextRoundMatchPosition: FALLBACK_MATCH_RELATION_POSITION,
        previousUpperRoundMatchPosition: (generateMatchPosition(match, relation.previousRoundMatchFactor) -
          double) as BracketMatchPosition,
        previousLowerRoundMatchPosition: generateMatchPosition(match, relation.previousRoundMatchFactor),
      };
    }

    case 'one-to-one': {
      const double = relation.previousRoundMatchFactor === 2 ? 1 : 0;
      return {
        nextRoundMatchPosition: generateMatchPosition(match, relation.nextRoundMatchFactor),
        previousUpperRoundMatchPosition: (generateMatchPosition(match, relation.previousRoundMatchFactor) -
          double) as BracketMatchPosition,
        previousLowerRoundMatchPosition: generateMatchPosition(match, relation.previousRoundMatchFactor),
      };
    }

    case 'two-to-one':
      return {
        nextRoundMatchPosition: generateMatchPosition(match, relation.nextRoundMatchFactor),
        previousUpperRoundMatchPosition: generateMatchPosition(match, relation.previousUpperRoundMatchFactor),
        previousLowerRoundMatchPosition: generateMatchPosition(match, relation.previousLowerRoundMatchFactor),
      };

    case 'two-to-nothing':
      return {
        nextRoundMatchPosition: FALLBACK_MATCH_RELATION_POSITION,
        previousUpperRoundMatchPosition: generateMatchPosition(match, relation.previousUpperRoundMatchFactor),
        previousLowerRoundMatchPosition: generateMatchPosition(match, relation.previousLowerRoundMatchFactor),
      };
  }
};

const createNothingToOneRelation = <TRoundData, TMatchData>(params: {
  match: NewBracketMatch<TRoundData, TMatchData>;
  relation: Extract<BracketRoundRelation<TRoundData, TMatchData>, { type: 'nothing-to-one' }>;
  matchPositionMaps: MatchPositionMaps<TRoundData, TMatchData>;
  nextRoundMatchPosition: BracketMatchPosition;
}): BracketMatchRelationNothingToOne<TRoundData, TMatchData> => {
  const { match, relation, matchPositionMaps, nextRoundMatchPosition } = params;

  const nextMatch = matchPositionMaps.get(relation.nextRound.id)?.get(nextRoundMatchPosition);

  if (!nextMatch) throw new Error('Next round match not found');

  return {
    type: 'nothing-to-one',
    currentMatch: match,
    currentRound: relation.currentRound,
    nextMatch,
    nextRound: relation.nextRound,
  };
};

const createOneToNothingOrTwoToNothingRelation = <TRoundData, TMatchData>(params: {
  match: NewBracketMatch<TRoundData, TMatchData>;
  relation: Extract<BracketRoundRelation<TRoundData, TMatchData>, { type: 'one-to-nothing' }>;
  matchPositionMaps: MatchPositionMaps<TRoundData, TMatchData>;
  previousUpperRoundMatchPosition: BracketMatchPosition;
  previousLowerRoundMatchPosition: BracketMatchPosition;
}):
  | BracketMatchRelationOneToNothing<TRoundData, TMatchData>
  | BracketMatchRelationTwoToNothing<TRoundData, TMatchData> => {
  const { match, relation, matchPositionMaps, previousUpperRoundMatchPosition, previousLowerRoundMatchPosition } =
    params;

  const previousUpperMatch = matchPositionMaps.get(relation.previousRound.id)?.get(previousUpperRoundMatchPosition);
  const previousLowerMatch = matchPositionMaps.get(relation.previousRound.id)?.get(previousLowerRoundMatchPosition);

  if (!previousUpperMatch) throw new Error('Previous round match not found');

  if (previousUpperRoundMatchPosition !== previousLowerRoundMatchPosition) {
    if (!previousLowerMatch) throw new Error('Previous lower round match not found');
    return {
      type: 'two-to-nothing',
      currentMatch: match,
      currentRound: relation.currentRound,
      previousUpperMatch,
      previousUpperRound: relation.previousRound,
      previousLowerMatch,
      previousLowerRound: relation.previousRound,
    };
  } else {
    return {
      type: 'one-to-nothing',
      currentMatch: match,
      currentRound: relation.currentRound,
      previousMatch: previousUpperMatch,
      previousRound: relation.previousRound,
    };
  }
};

const createOneToOneOrTwoToOneRelation = <TRoundData, TMatchData>(params: {
  match: NewBracketMatch<TRoundData, TMatchData>;
  relation: Extract<BracketRoundRelation<TRoundData, TMatchData>, { type: 'one-to-one' }>;
  matchPositionMaps: MatchPositionMaps<TRoundData, TMatchData>;
  nextRoundMatchPosition: BracketMatchPosition;
  previousUpperRoundMatchPosition: BracketMatchPosition;
  previousLowerRoundMatchPosition: BracketMatchPosition;
}): BracketMatchRelationOneToOne<TRoundData, TMatchData> | BracketMatchRelationTwoToOne<TRoundData, TMatchData> => {
  const {
    match,
    relation,
    matchPositionMaps,
    nextRoundMatchPosition,
    previousUpperRoundMatchPosition,
    previousLowerRoundMatchPosition,
  } = params;

  const nextMatch = matchPositionMaps.get(relation.nextRound.id)?.get(nextRoundMatchPosition);
  const previousUpperMatch = matchPositionMaps.get(relation.previousRound.id)?.get(previousUpperRoundMatchPosition);
  const previousLowerMatch = matchPositionMaps.get(relation.previousRound.id)?.get(previousLowerRoundMatchPosition);

  if (!nextMatch) throw new Error('Next round match not found');
  if (!previousUpperMatch) throw new Error('Previous upper round match not found');
  if (!previousLowerMatch) throw new Error('Previous lower round match not found');

  if (previousUpperRoundMatchPosition === previousLowerRoundMatchPosition) {
    return {
      type: 'one-to-one',
      currentMatch: match,
      currentRound: relation.currentRound,
      previousMatch: previousUpperMatch,
      previousRound: relation.previousRound,
      nextMatch,
      nextRound: relation.nextRound,
    };
  } else {
    return {
      type: 'two-to-one',
      currentMatch: match,
      currentRound: relation.currentRound,
      previousUpperMatch,
      previousUpperRound: relation.previousRound,
      previousLowerMatch,
      previousLowerRound: relation.previousRound,
      nextMatch,
      nextRound: relation.nextRound,
    };
  }
};

const createTwoToOneRelation = <TRoundData, TMatchData>(params: {
  match: NewBracketMatch<TRoundData, TMatchData>;
  relation: Extract<BracketRoundRelation<TRoundData, TMatchData>, { type: 'two-to-one' }>;
  matchPositionMaps: MatchPositionMaps<TRoundData, TMatchData>;
  nextRoundMatchPosition: BracketMatchPosition;
  previousUpperRoundMatchPosition: BracketMatchPosition;
  previousLowerRoundMatchPosition: BracketMatchPosition;
}): BracketMatchRelationTwoToOne<TRoundData, TMatchData> => {
  const {
    match,
    relation,
    matchPositionMaps,
    nextRoundMatchPosition,
    previousUpperRoundMatchPosition,
    previousLowerRoundMatchPosition,
  } = params;

  const nextMatch = matchPositionMaps.get(relation.nextRound.id)?.get(nextRoundMatchPosition);
  const previousUpperMatch = matchPositionMaps
    .get(relation.previousUpperRound.id)
    ?.get(previousUpperRoundMatchPosition);
  const previousLowerMatch = matchPositionMaps
    .get(relation.previousLowerRound.id)
    ?.get(previousLowerRoundMatchPosition);

  if (!nextMatch) throw new Error('Next round match not found');
  if (!previousUpperMatch) throw new Error('Previous upper round match not found');
  if (!previousLowerMatch) throw new Error('Previous lower round match not found');

  return {
    type: 'two-to-one',
    currentMatch: match,
    currentRound: relation.currentRound,
    previousUpperMatch,
    previousUpperRound: relation.previousUpperRound,
    previousLowerMatch,
    previousLowerRound: relation.previousLowerRound,
    nextMatch,
    nextRound: relation.nextRound,
  };
};

const createTwoToNothingRelation = <TRoundData, TMatchData>(params: {
  match: NewBracketMatch<TRoundData, TMatchData>;
  relation: Extract<BracketRoundRelation<TRoundData, TMatchData>, { type: 'two-to-nothing' }>;
  matchPositionMaps: MatchPositionMaps<TRoundData, TMatchData>;
  previousUpperRoundMatchPosition: BracketMatchPosition;
  previousLowerRoundMatchPosition: BracketMatchPosition;
}): BracketMatchRelationTwoToNothing<TRoundData, TMatchData> => {
  const { match, relation, matchPositionMaps, previousUpperRoundMatchPosition, previousLowerRoundMatchPosition } =
    params;

  const previousUpperMatch = matchPositionMaps
    .get(relation.previousUpperRound.id)
    ?.get(previousUpperRoundMatchPosition);
  const previousLowerMatch = matchPositionMaps
    .get(relation.previousUpperRound.id)
    ?.get(previousLowerRoundMatchPosition);

  if (!previousUpperMatch) throw new Error('Previous upper round match not found');
  if (!previousLowerMatch) throw new Error('Previous lower round match not found');

  return {
    type: 'two-to-nothing',
    currentMatch: match,
    currentRound: relation.currentRound,
    previousUpperMatch,
    previousUpperRound: relation.previousUpperRound,
    previousLowerMatch,
    previousLowerRound: relation.previousUpperRound,
  };
};

export const generateMatchRelationsNew = <TRoundData, TMatchData>(
  bracketData: NewBracket<TRoundData, TMatchData>,
): BracketMatchRelation<TRoundData, TMatchData>[] => {
  const matchRelations: BracketMatchRelation<TRoundData, TMatchData>[] = [];
  const matchPositionMaps: MatchPositionMaps<TRoundData, TMatchData> = new Map();

  for (const round of bracketData.rounds.values()) {
    const matchMap = new Map([...round.matches.values()].map((m) => [m.position, m]));
    matchPositionMaps.set(round.id, matchMap);
  }

  for (const match of bracketData.matches.values()) {
    const relation = match.round.relation;
    const { nextRoundMatchPosition, previousUpperRoundMatchPosition, previousLowerRoundMatchPosition } =
      generateMatchRelationPositions(relation, match);

    switch (relation.type) {
      case 'nothing-to-one':
        matchRelations.push(
          createNothingToOneRelation({
            match,
            relation,
            matchPositionMaps,
            nextRoundMatchPosition,
          }),
        );
        break;

      case 'one-to-nothing':
        matchRelations.push(
          createOneToNothingOrTwoToNothingRelation({
            match,
            relation,
            matchPositionMaps,
            previousUpperRoundMatchPosition,
            previousLowerRoundMatchPosition,
          }),
        );
        break;

      case 'one-to-one':
        matchRelations.push(
          createOneToOneOrTwoToOneRelation({
            match,
            relation,
            matchPositionMaps,
            nextRoundMatchPosition,
            previousUpperRoundMatchPosition,
            previousLowerRoundMatchPosition,
          }),
        );
        break;

      case 'two-to-one':
        matchRelations.push(
          createTwoToOneRelation({
            match,
            relation,
            matchPositionMaps,
            nextRoundMatchPosition,
            previousUpperRoundMatchPosition,
            previousLowerRoundMatchPosition,
          }),
        );
        break;

      case 'two-to-nothing':
        matchRelations.push(
          createTwoToNothingRelation({
            match,
            relation,
            matchPositionMaps,
            previousUpperRoundMatchPosition,
            previousLowerRoundMatchPosition,
          }),
        );
        break;
    }
  }

  return matchRelations;
};
