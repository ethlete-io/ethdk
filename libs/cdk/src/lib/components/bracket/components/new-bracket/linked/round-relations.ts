import { BRACKET_ROUND_MIRROR_TYPE, COMMON_BRACKET_ROUND_TYPE, DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE } from '../core';
import { NewBracket, NewBracketRound } from './bracket';

// One round has one next round (the first round of the bracket)
export type BracketRoundRelationNothingToOne<TRoundData, TMatchData> = {
  type: 'nothing-to-one';
  currentRound: NewBracketRound<TRoundData, TMatchData>;
  nextRound: NewBracketRound<TRoundData, TMatchData>;
  nextRoundMatchFactor: number;
};

// One round has one previous round (eg. the finals round of the bracket in case of a single elimination bracket)
export type BracketRoundRelationOneToNothing<TRoundData, TMatchData> = {
  type: 'one-to-nothing';
  currentRound: NewBracketRound<TRoundData, TMatchData>;
  previousRound: NewBracketRound<TRoundData, TMatchData>;
  previousRoundMatchFactor: number;
  rootRoundMatchFactor: number;
};

// One round has one previous round and one next round (eg. a normal round in the bracket that is neither the start nor the end)
export type BracketRoundRelationOneToOne<TRoundData, TMatchData> = {
  type: 'one-to-one';
  currentRound: NewBracketRound<TRoundData, TMatchData>;
  previousRound: NewBracketRound<TRoundData, TMatchData>;
  nextRound: NewBracketRound<TRoundData, TMatchData>;
  nextRoundMatchFactor: number;
  previousRoundMatchFactor: number;
  rootRoundMatchFactor: number;
};

// One round has two previous rounds and one next round (eg. the finals round in a double elimination bracket when the reverse finals is also being played)
export type BracketRoundRelationTwoToOne<TRoundData, TMatchData> = {
  type: 'two-to-one';
  currentRound: NewBracketRound<TRoundData, TMatchData>;
  previousUpperRound: NewBracketRound<TRoundData, TMatchData>;
  previousLowerRound: NewBracketRound<TRoundData, TMatchData>;
  nextRound: NewBracketRound<TRoundData, TMatchData>;
  nextRoundMatchFactor: number;
  previousUpperRoundMatchFactor: number;
  previousLowerRoundMatchFactor: number;
  upperRootRoundMatchFactor: number;
  lowerRootRoundMatchFactor: number;
};

// One round has two previous rounds and no next round (eg. the finals round in a double elimination bracket when the reverse finals is not being played)
export type BracketRoundRelationTwoToNothing<TRoundData, TMatchData> = {
  type: 'two-to-nothing';
  currentRound: NewBracketRound<TRoundData, TMatchData>;
  previousUpperRound: NewBracketRound<TRoundData, TMatchData>;
  previousLowerRound: NewBracketRound<TRoundData, TMatchData>;
  previousUpperRoundMatchFactor: number;
  previousLowerRoundMatchFactor: number;
  upperRootRoundMatchFactor: number;
  lowerRootRoundMatchFactor: number;
};

export type BracketRoundRelation<TRoundData, TMatchData> =
  | BracketRoundRelationNothingToOne<TRoundData, TMatchData>
  | BracketRoundRelationOneToNothing<TRoundData, TMatchData>
  | BracketRoundRelationOneToOne<TRoundData, TMatchData>
  | BracketRoundRelationTwoToOne<TRoundData, TMatchData>
  | BracketRoundRelationTwoToNothing<TRoundData, TMatchData>;

export const generateRoundRelationsNew = <TRoundData, TMatchData>(bracketData: NewBracket<TRoundData, TMatchData>) => {
  const roundRelations: BracketRoundRelation<TRoundData, TMatchData>[] = [];

  const allRounds = [...bracketData.rounds.values()];
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
        roundRelations.push({
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
        roundRelations.push({
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
        roundRelations.push({
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
          roundRelations.push({
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
          roundRelations.push({
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
        roundRelations.push({
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

      roundRelations.push({
        type: 'one-to-nothing',
        previousRound: previousUpperRound,
        currentRound: currentUpperRound,
        previousRoundMatchFactor: previousUpperRound.matchCount / currentUpperRound.matchCount,
        rootRoundMatchFactor: firstUpperRound.matchCount / currentUpperRound.matchCount,
      });
    } else if (currentUpperRound.isFirstRound) {
      // nothing to one relation

      if (!nextUpperRound) throw new Error('nextUpperRound is null');

      roundRelations.push({
        type: 'nothing-to-one',
        nextRound: nextUpperRound,
        currentRound: currentUpperRound,
        nextRoundMatchFactor: nextUpperRound.matchCount / currentUpperRound.matchCount,
      });

      if (currentLowerRound) {
        if (!nextLowerRound) throw new Error('nextLowerRound is null');

        roundRelations.push({
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

      roundRelations.push({
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

        roundRelations.push({
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
