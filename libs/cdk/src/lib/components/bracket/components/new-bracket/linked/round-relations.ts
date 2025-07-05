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

const calculateMatchFactor = <TRoundData, TMatchData>(
  numeratorRound: NewBracketRound<TRoundData, TMatchData>,
  denominatorRound: NewBracketRound<TRoundData, TMatchData>,
): number => numeratorRound.matchCount / denominatorRound.matchCount;

const createNothingToOneRelation = <TRoundData, TMatchData>(params: {
  currentRound: NewBracketRound<TRoundData, TMatchData>;
  nextRound: NewBracketRound<TRoundData, TMatchData>;
}): BracketRoundRelationNothingToOne<TRoundData, TMatchData> => ({
  type: 'nothing-to-one',
  currentRound: params.currentRound,
  nextRound: params.nextRound,
  nextRoundMatchFactor: calculateMatchFactor(params.nextRound, params.currentRound),
});

const createOneToNothingRelation = <TRoundData, TMatchData>(params: {
  currentRound: NewBracketRound<TRoundData, TMatchData>;
  previousRound: NewBracketRound<TRoundData, TMatchData>;
  rootRound: NewBracketRound<TRoundData, TMatchData>;
}): BracketRoundRelationOneToNothing<TRoundData, TMatchData> => ({
  type: 'one-to-nothing',
  currentRound: params.currentRound,
  previousRound: params.previousRound,
  previousRoundMatchFactor: calculateMatchFactor(params.previousRound, params.currentRound),
  rootRoundMatchFactor: calculateMatchFactor(params.rootRound, params.currentRound),
});

const createOneToOneRelation = <TRoundData, TMatchData>(params: {
  currentRound: NewBracketRound<TRoundData, TMatchData>;
  previousRound: NewBracketRound<TRoundData, TMatchData>;
  nextRound: NewBracketRound<TRoundData, TMatchData>;
  rootRound: NewBracketRound<TRoundData, TMatchData>;
}): BracketRoundRelationOneToOne<TRoundData, TMatchData> => ({
  type: 'one-to-one',
  currentRound: params.currentRound,
  previousRound: params.previousRound,
  nextRound: params.nextRound,
  nextRoundMatchFactor: calculateMatchFactor(params.nextRound, params.currentRound),
  previousRoundMatchFactor: calculateMatchFactor(params.previousRound, params.currentRound),
  rootRoundMatchFactor: calculateMatchFactor(params.rootRound, params.currentRound),
});

const createTwoToOneRelation = <TRoundData, TMatchData>(params: {
  currentRound: NewBracketRound<TRoundData, TMatchData>;
  previousUpperRound: NewBracketRound<TRoundData, TMatchData>;
  previousLowerRound: NewBracketRound<TRoundData, TMatchData>;
  nextRound: NewBracketRound<TRoundData, TMatchData>;
  firstUpperRound: NewBracketRound<TRoundData, TMatchData>;
  firstLowerRound: NewBracketRound<TRoundData, TMatchData>;
}): BracketRoundRelationTwoToOne<TRoundData, TMatchData> => ({
  type: 'two-to-one',
  currentRound: params.currentRound,
  previousUpperRound: params.previousUpperRound,
  previousLowerRound: params.previousLowerRound,
  nextRound: params.nextRound,
  nextRoundMatchFactor: calculateMatchFactor(params.nextRound, params.currentRound),
  previousUpperRoundMatchFactor: calculateMatchFactor(params.previousUpperRound, params.currentRound),
  previousLowerRoundMatchFactor: calculateMatchFactor(params.previousLowerRound, params.currentRound),
  upperRootRoundMatchFactor: calculateMatchFactor(params.firstUpperRound, params.currentRound),
  lowerRootRoundMatchFactor: calculateMatchFactor(params.firstLowerRound, params.currentRound),
});

const createTwoToNothingRelation = <TRoundData, TMatchData>(params: {
  currentRound: NewBracketRound<TRoundData, TMatchData>;
  previousUpperRound: NewBracketRound<TRoundData, TMatchData>;
  previousLowerRound: NewBracketRound<TRoundData, TMatchData>;
  firstUpperRound: NewBracketRound<TRoundData, TMatchData>;
  firstLowerRound: NewBracketRound<TRoundData, TMatchData>;
}): BracketRoundRelationTwoToNothing<TRoundData, TMatchData> => ({
  type: 'two-to-nothing',
  currentRound: params.currentRound,
  previousUpperRound: params.previousUpperRound,
  previousLowerRound: params.previousLowerRound,
  previousUpperRoundMatchFactor: calculateMatchFactor(params.previousUpperRound, params.currentRound),
  previousLowerRoundMatchFactor: calculateMatchFactor(params.previousLowerRound, params.currentRound),
  upperRootRoundMatchFactor: calculateMatchFactor(params.firstUpperRound, params.currentRound),
  lowerRootRoundMatchFactor: calculateMatchFactor(params.firstLowerRound, params.currentRound),
});

const getNavigationContext = <TRoundData, TMatchData>(params: {
  upperRounds: NewBracketRound<TRoundData, TMatchData>[];
  currentUpperRoundIndex: number;
}) => {
  const { upperRounds, currentUpperRoundIndex } = params;
  const currentUpperRound = upperRounds[currentUpperRoundIndex];

  if (!currentUpperRound) throw new Error('currentUpperRound is null');

  const isLeftToRight =
    !currentUpperRound.mirrorRoundType || currentUpperRound.mirrorRoundType === BRACKET_ROUND_MIRROR_TYPE.LEFT;

  const relativePrevious = upperRounds[currentUpperRoundIndex - 1] || null;
  const relativeNext = upperRounds[currentUpperRoundIndex + 1] || null;

  const previousUpperRound = isLeftToRight ? relativePrevious : relativeNext;
  const nextUpperRound = isLeftToRight ? relativeNext : relativePrevious;

  const isLastUpperRound =
    !nextUpperRound ||
    (nextUpperRound.mirrorRoundType === BRACKET_ROUND_MIRROR_TYPE.RIGHT && !currentUpperRound.mirrorRoundType);

  const isFinal = currentUpperRound.type === COMMON_BRACKET_ROUND_TYPE.FINAL;

  return {
    currentUpperRound,
    previousUpperRound,
    nextUpperRound,
    isLastUpperRound,
    isFinal,
  };
};

const handleFinalRound = <TRoundData, TMatchData>(params: {
  relations: BracketRoundRelation<TRoundData, TMatchData>[];
  currentUpperRound: NewBracketRound<TRoundData, TMatchData>;
  previousUpperRound: NewBracketRound<TRoundData, TMatchData>;
  nextUpperRound: NewBracketRound<TRoundData, TMatchData> | null;
  lowerRounds: NewBracketRound<TRoundData, TMatchData>[];
  currentUpperRoundIndex: number;
  firstUpperRound: NewBracketRound<TRoundData, TMatchData>;
  firstLowerRound: NewBracketRound<TRoundData, TMatchData>;
  lastLowerRound: NewBracketRound<TRoundData, TMatchData>;
}) => {
  const {
    relations,
    currentUpperRound,
    previousUpperRound,
    nextUpperRound,
    lowerRounds,
    currentUpperRoundIndex,
    firstUpperRound,
    firstLowerRound,
    lastLowerRound,
  } = params;

  const currentLowerRound = lowerRounds[currentUpperRoundIndex] || null;
  const nextLowerRound = lowerRounds[currentUpperRoundIndex + 1] || null;
  const previousLowerRound = lowerRounds[currentUpperRoundIndex - 1] || null;

  if (!currentLowerRound) throw new Error('currentLowerRound is null');

  const isAsyncBracket = currentLowerRound.id !== lastLowerRound.id;
  const finalLowerRound = isAsyncBracket ? nextLowerRound : currentLowerRound;

  if (!finalLowerRound) throw new Error('finalLowerRound is null');
  if (finalLowerRound.id !== lastLowerRound.id) throw new Error('finalLowerRound is not the last lower round');

  if (nextUpperRound) {
    relations.push(
      createTwoToOneRelation({
        currentRound: currentUpperRound,
        previousUpperRound,
        previousLowerRound: finalLowerRound,
        nextRound: nextUpperRound,
        firstUpperRound,
        firstLowerRound,
      }),
    );
  } else {
    relations.push(
      createTwoToNothingRelation({
        currentRound: currentUpperRound,
        previousUpperRound,
        previousLowerRound: finalLowerRound,
        firstUpperRound,
        firstLowerRound,
      }),
    );
  }

  if (isAsyncBracket) {
    const preFinalLowerRound = lowerRounds[lowerRounds.length - 2];
    const prePreFinalLowerRound = lowerRounds[lowerRounds.length - 3] || null;

    if (!preFinalLowerRound) throw new Error('preFinalLowerRound is null');

    relations.push(
      createOneToOneRelation({
        currentRound: finalLowerRound,
        previousRound: preFinalLowerRound,
        nextRound: currentUpperRound,
        rootRound: firstLowerRound,
      }),
    );

    if (prePreFinalLowerRound) {
      relations.push(
        createOneToOneRelation({
          currentRound: preFinalLowerRound,
          previousRound: prePreFinalLowerRound,
          nextRound: finalLowerRound,
          rootRound: firstLowerRound,
        }),
      );
    } else {
      relations.push(
        createNothingToOneRelation({
          currentRound: preFinalLowerRound,
          nextRound: finalLowerRound,
        }),
      );
    }
  } else {
    if (!previousLowerRound) throw new Error('previousLowerRound is null');
    relations.push(
      createOneToOneRelation({
        currentRound: finalLowerRound,
        previousRound: previousLowerRound,
        nextRound: currentUpperRound,
        rootRound: firstLowerRound,
      }),
    );
  }
};

const handleFirstRound = <TRoundData, TMatchData>(params: {
  relations: BracketRoundRelation<TRoundData, TMatchData>[];
  currentUpperRound: NewBracketRound<TRoundData, TMatchData>;
  nextUpperRound: NewBracketRound<TRoundData, TMatchData>;
  lowerRounds: NewBracketRound<TRoundData, TMatchData>[];
  currentUpperRoundIndex: number;
}) => {
  const { relations, currentUpperRound, nextUpperRound, lowerRounds, currentUpperRoundIndex } = params;

  relations.push(
    createNothingToOneRelation({
      currentRound: currentUpperRound,
      nextRound: nextUpperRound,
    }),
  );

  const currentLowerRound = lowerRounds[currentUpperRoundIndex] || null;
  const nextLowerRound = lowerRounds[currentUpperRoundIndex + 1] || null;

  if (currentLowerRound && nextLowerRound) {
    relations.push(
      createNothingToOneRelation({
        currentRound: currentLowerRound,
        nextRound: nextLowerRound,
      }),
    );
  }
};

const handleRegularRound = <TRoundData, TMatchData>(params: {
  relations: BracketRoundRelation<TRoundData, TMatchData>[];
  currentUpperRound: NewBracketRound<TRoundData, TMatchData>;
  previousUpperRound: NewBracketRound<TRoundData, TMatchData>;
  nextUpperRound: NewBracketRound<TRoundData, TMatchData>;
  lowerRounds: NewBracketRound<TRoundData, TMatchData>[];
  currentUpperRoundIndex: number;
  firstUpperRound: NewBracketRound<TRoundData, TMatchData>;
  firstLowerRound: NewBracketRound<TRoundData, TMatchData> | null;
}) => {
  const {
    relations,
    currentUpperRound,
    previousUpperRound,
    nextUpperRound,
    lowerRounds,
    currentUpperRoundIndex,
    firstUpperRound,
    firstLowerRound,
  } = params;

  relations.push(
    createOneToOneRelation({
      currentRound: currentUpperRound,
      previousRound: previousUpperRound,
      nextRound: nextUpperRound,
      rootRound: firstUpperRound,
    }),
  );

  const currentLowerRound = lowerRounds[currentUpperRoundIndex] || null;
  const previousLowerRound = lowerRounds[currentUpperRoundIndex - 1] || null;
  const nextLowerRound = lowerRounds[currentUpperRoundIndex + 1] || null;

  if (
    currentLowerRound &&
    currentUpperRound.type === DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.UPPER_BRACKET &&
    previousLowerRound &&
    nextLowerRound &&
    firstLowerRound
  ) {
    relations.push(
      createOneToOneRelation({
        currentRound: currentLowerRound,
        previousRound: previousLowerRound,
        nextRound: nextLowerRound,
        rootRound: firstLowerRound,
      }),
    );
  }
};

export const generateRoundRelationsNew = <TRoundData, TMatchData>(
  bracketData: NewBracket<TRoundData, TMatchData>,
): BracketRoundRelation<TRoundData, TMatchData>[] => {
  const relations: BracketRoundRelation<TRoundData, TMatchData>[] = [];

  const allRounds = [...bracketData.rounds.values()];
  const upperRounds = allRounds.filter((r) => r.type !== DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.LOWER_BRACKET);
  const lowerRounds = allRounds.filter((r) => r.type === DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.LOWER_BRACKET);

  const firstUpperRound = upperRounds[0];
  const firstLowerRound = lowerRounds[0] || null;
  const lastLowerRound = lowerRounds[lowerRounds.length - 1] || null;

  if (!firstUpperRound) throw new Error('No upper rounds found');

  const hasLowerRounds = lowerRounds.length > 0;

  for (const [currentUpperRoundIndex] of upperRounds.entries()) {
    const nav = getNavigationContext({
      upperRounds,
      currentUpperRoundIndex,
    });

    if (nav.isFinal && hasLowerRounds && lastLowerRound && firstLowerRound && nav.previousUpperRound) {
      handleFinalRound({
        relations,
        currentUpperRound: nav.currentUpperRound,
        previousUpperRound: nav.previousUpperRound,
        nextUpperRound: nav.nextUpperRound,
        lowerRounds,
        currentUpperRoundIndex,
        firstUpperRound,
        firstLowerRound,
        lastLowerRound,
      });
    } else if (nav.isLastUpperRound && nav.previousUpperRound) {
      relations.push(
        createOneToNothingRelation({
          currentRound: nav.currentUpperRound,
          previousRound: nav.previousUpperRound,
          rootRound: firstUpperRound,
        }),
      );
    } else if (nav.currentUpperRound.isFirstRound && nav.nextUpperRound) {
      handleFirstRound({
        relations,
        currentUpperRound: nav.currentUpperRound,
        nextUpperRound: nav.nextUpperRound,
        lowerRounds,
        currentUpperRoundIndex,
      });
    } else if (nav.previousUpperRound && nav.nextUpperRound) {
      handleRegularRound({
        relations,
        currentUpperRound: nav.currentUpperRound,
        previousUpperRound: nav.previousUpperRound,
        nextUpperRound: nav.nextUpperRound,
        lowerRounds,
        currentUpperRoundIndex,
        firstUpperRound,
        firstLowerRound,
      });
    }
  }

  return relations;
};
