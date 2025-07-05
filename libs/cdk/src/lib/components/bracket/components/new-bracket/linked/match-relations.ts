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

export const generateMatchRelationsNew = <TRoundData, TMatchData>(bracketData: NewBracket<TRoundData, TMatchData>) => {
  const matchRelations: BracketMatchRelation<TRoundData, TMatchData>[] = [];

  const matchPositionMaps: MatchPositionMaps<TRoundData, TMatchData> = new Map();

  for (const round of bracketData.rounds.values()) {
    const matchMap = new Map([...round.matches.values()].map((m) => [m.position, m]));

    matchPositionMaps.set(round.id, matchMap);
  }

  for (const match of bracketData.matches.values()) {
    const currentRelation = match.round.relation;

    const { nextRoundMatchPosition, previousLowerRoundMatchPosition, previousUpperRoundMatchPosition } =
      generateMatchRelationPositions(currentRelation, match);

    switch (currentRelation.type) {
      case 'nothing-to-one': {
        const nextMatch = matchPositionMaps.get(currentRelation.nextRound.id)?.get(nextRoundMatchPosition);

        if (!nextMatch) throw new Error('Next round match not found');

        // means left is nothing. right is one
        matchRelations.push({
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

          matchRelations.push({
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
          matchRelations.push({
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
          matchRelations.push({
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
          matchRelations.push({
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

        matchRelations.push({
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

        matchRelations.push({
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

export type MatchPositionMaps<TRoundData, TMatchData> = Map<
  BracketRoundId,
  Map<BracketMatchPosition, NewBracketMatch<TRoundData, TMatchData>>
>;

export const generateMatchRelationPositions = <TRoundData, TMatchData>(
  currentRelation: BracketRoundRelation<TRoundData, TMatchData>,
  match: NewBracketMatch<TRoundData, TMatchData>,
) => {
  switch (currentRelation.type) {
    case 'nothing-to-one': {
      return {
        nextRoundMatchPosition: generateMatchPosition(match, currentRelation.nextRoundMatchFactor),
        previousUpperRoundMatchPosition: FALLBACK_MATCH_RELATION_POSITION,
        previousLowerRoundMatchPosition: FALLBACK_MATCH_RELATION_POSITION,
      };
    }
    case 'one-to-nothing': {
      const previousRoundHasDoubleTheMatchCount = currentRelation.previousRoundMatchFactor === 2;
      const doubleUpperMatchCountShift = previousRoundHasDoubleTheMatchCount ? 1 : 0;

      return {
        nextRoundMatchPosition: FALLBACK_MATCH_RELATION_POSITION,
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
        nextRoundMatchPosition: FALLBACK_MATCH_RELATION_POSITION,
        previousUpperRoundMatchPosition: generateMatchPosition(match, currentRelation.previousUpperRoundMatchFactor),
        previousLowerRoundMatchPosition: generateMatchPosition(match, currentRelation.previousLowerRoundMatchFactor),
      };
    }
  }
};

export const generateMatchPosition = (match: NewBracketMatch<unknown, unknown>, factor: BracketMatchFactor) => {
  return Math.ceil(match.position * factor) as BracketMatchPosition;
};
