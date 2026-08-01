import { BRACKET_ROUND_MIRROR_TYPE, COMMON_BRACKET_ROUND_TYPE, DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE } from '../core';
import { Bracket, BracketRound } from './bracket';
import { RuntimeError } from '@ethlete/core';
import { BRACKET_ERROR_CODES } from '../bracket-errors';

// One round has one next round (the first round of the bracket)
export type BracketRoundRelationNothingToOne<TRoundData, TMatchData> = {
  type: 'nothing-to-one';
  currentRound: BracketRound<TRoundData, TMatchData>;
  nextRound: BracketRound<TRoundData, TMatchData>;
  nextRoundMatchFactor: number;
};

// One round has one previous round (eg. the finals round of the bracket in case of a single elimination bracket)
export type BracketRoundRelationOneToNothing<TRoundData, TMatchData> = {
  type: 'one-to-nothing';
  currentRound: BracketRound<TRoundData, TMatchData>;
  previousRound: BracketRound<TRoundData, TMatchData>;
  previousRoundMatchFactor: number;
  rootRoundMatchFactor: number;
};

// One round has one previous round and one next round (eg. a normal round in the bracket that is neither the start nor the end)
export type BracketRoundRelationOneToOne<TRoundData, TMatchData> = {
  type: 'one-to-one';
  currentRound: BracketRound<TRoundData, TMatchData>;
  previousRound: BracketRound<TRoundData, TMatchData>;
  nextRound: BracketRound<TRoundData, TMatchData>;
  nextRoundMatchFactor: number;
  previousRoundMatchFactor: number;
  rootRoundMatchFactor: number;
};

// One round has two previous rounds and one next round (eg. the finals round in a double elimination bracket when the reverse finals is also being played)
export type BracketRoundRelationTwoToOne<TRoundData, TMatchData> = {
  type: 'two-to-one';
  currentRound: BracketRound<TRoundData, TMatchData>;
  previousUpperRound: BracketRound<TRoundData, TMatchData>;
  previousLowerRound: BracketRound<TRoundData, TMatchData>;
  nextRound: BracketRound<TRoundData, TMatchData>;
  nextRoundMatchFactor: number;
  previousUpperRoundMatchFactor: number;
  previousLowerRoundMatchFactor: number;
  upperRootRoundMatchFactor: number;
  lowerRootRoundMatchFactor: number;
};

// One round has two previous rounds and no next round (eg. the finals round in a double elimination bracket when the reverse finals is not being played)
export type BracketRoundRelationTwoToNothing<TRoundData, TMatchData> = {
  type: 'two-to-nothing';
  currentRound: BracketRound<TRoundData, TMatchData>;
  previousUpperRound: BracketRound<TRoundData, TMatchData>;
  previousLowerRound: BracketRound<TRoundData, TMatchData>;
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
  numeratorRound: BracketRound<TRoundData, TMatchData>,
  denominatorRound: BracketRound<TRoundData, TMatchData>,
) => numeratorRound.matchCount / denominatorRound.matchCount;

const createNothingToOneRelation = <TRoundData, TMatchData>(params: {
  currentRound: BracketRound<TRoundData, TMatchData>;
  nextRound: BracketRound<TRoundData, TMatchData>;
}): BracketRoundRelationNothingToOne<TRoundData, TMatchData> => ({
  type: 'nothing-to-one',
  currentRound: params.currentRound,
  nextRound: params.nextRound,
  nextRoundMatchFactor: calculateMatchFactor(params.nextRound, params.currentRound),
});

const createOneToNothingRelation = <TRoundData, TMatchData>(params: {
  currentRound: BracketRound<TRoundData, TMatchData>;
  previousRound: BracketRound<TRoundData, TMatchData>;
  rootRound: BracketRound<TRoundData, TMatchData>;
}): BracketRoundRelationOneToNothing<TRoundData, TMatchData> => ({
  type: 'one-to-nothing',
  currentRound: params.currentRound,
  previousRound: params.previousRound,
  previousRoundMatchFactor: calculateMatchFactor(params.previousRound, params.currentRound),
  rootRoundMatchFactor: calculateMatchFactor(params.rootRound, params.currentRound),
});

const createOneToOneRelation = <TRoundData, TMatchData>(params: {
  currentRound: BracketRound<TRoundData, TMatchData>;
  previousRound: BracketRound<TRoundData, TMatchData>;
  nextRound: BracketRound<TRoundData, TMatchData>;
  rootRound: BracketRound<TRoundData, TMatchData>;
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
  currentRound: BracketRound<TRoundData, TMatchData>;
  previousUpperRound: BracketRound<TRoundData, TMatchData>;
  previousLowerRound: BracketRound<TRoundData, TMatchData>;
  nextRound: BracketRound<TRoundData, TMatchData>;
  firstUpperRound: BracketRound<TRoundData, TMatchData>;
  firstLowerRound: BracketRound<TRoundData, TMatchData>;
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
  currentRound: BracketRound<TRoundData, TMatchData>;
  previousUpperRound: BracketRound<TRoundData, TMatchData>;
  previousLowerRound: BracketRound<TRoundData, TMatchData>;
  firstUpperRound: BracketRound<TRoundData, TMatchData>;
  firstLowerRound: BracketRound<TRoundData, TMatchData>;
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

/** A round drawn on the way back from the middle of a mirrored bracket. */
const isFoldedBackRound = <TRoundData, TMatchData>(round: BracketRound<TRoundData, TMatchData>) =>
  round.mirrorRoundType === BRACKET_ROUND_MIRROR_TYPE.RIGHT;

/** One bracket's rounds keyed by depth, with the two sides of a fold kept apart. */
type BracketRoundsByDepth<TRoundData, TMatchData> = Map<
  number,
  {
    left: BracketRound<TRoundData, TMatchData> | null;
    right: BracketRound<TRoundData, TMatchData> | null;
    /** The round at this depth that was never folded - the middle of a mirrored bracket. */
    single: BracketRound<TRoundData, TMatchData> | null;
  }
>;

const buildRoundsByDepth = <TRoundData, TMatchData>(
  rounds: BracketRound<TRoundData, TMatchData>[],
): BracketRoundsByDepth<TRoundData, TMatchData> => {
  const byDepth: BracketRoundsByDepth<TRoundData, TMatchData> = new Map();

  for (const round of rounds) {
    const slot = byDepth.get(round.logicalIndex) ?? { left: null, right: null, single: null };

    if (round.mirrorRoundType === BRACKET_ROUND_MIRROR_TYPE.LEFT) slot.left = round;
    else if (round.mirrorRoundType === BRACKET_ROUND_MIRROR_TYPE.RIGHT) slot.right = round;
    else slot.single = round;

    byDepth.set(round.logicalIndex, slot);
  }

  return byDepth;
};

/**
 * The round one depth along on the same side of the fold - or, where the fold has closed because that
 * depth was too small to halve, the whole round sitting in the middle.
 */
const roundAtDepth = <TRoundData, TMatchData>(params: {
  byDepth: BracketRoundsByDepth<TRoundData, TMatchData>;
  depth: number;
  side: BracketRound<TRoundData, TMatchData>['mirrorRoundType'];
}) => {
  const slot = params.byDepth.get(params.depth);

  if (!slot) return null;

  const sameSide = params.side === BRACKET_ROUND_MIRROR_TYPE.RIGHT ? slot.right : slot.left;

  return sameSide ?? slot.single ?? null;
};

const getNavigationContext = <TRoundData, TMatchData>(params: {
  upperRounds: BracketRound<TRoundData, TMatchData>[];
  upperRoundsByDepth: BracketRoundsByDepth<TRoundData, TMatchData>;
  currentUpperRoundIndex: number;
}) => {
  const { upperRounds, upperRoundsByDepth, currentUpperRoundIndex } = params;
  const currentUpperRound = upperRounds[currentUpperRoundIndex];

  if (!currentUpperRound)
    throw new RuntimeError(BRACKET_ERROR_CODES.ROUND_RELATION_INVALID, 'currentUpperRound is null');

  const isLeftToRight =
    !currentUpperRound.mirrorRoundType || currentUpperRound.mirrorRoundType === BRACKET_ROUND_MIRROR_TYPE.LEFT;

  // A folded half follows the fold, not the array. Its neighbours are the rounds one depth away on its
  // own side, because the array puts a right half next to whatever happened to be emitted beside it -
  // in a double elimination that is the grand final rather than the round it actually feeds.
  const isFolded = !!currentUpperRound.mirrorRoundType;
  const side = currentUpperRound.mirrorRoundType;
  const depth = currentUpperRound.logicalIndex;

  const relativePrevious = isFolded
    ? roundAtDepth({ byDepth: upperRoundsByDepth, depth: depth - 1, side })
    : upperRounds[currentUpperRoundIndex - 1] || null;
  const relativeNext = isFolded
    ? roundAtDepth({ byDepth: upperRoundsByDepth, depth: depth + 1, side })
    : upperRounds[currentUpperRoundIndex + 1] || null;

  // A folded half already resolved its own direction, so the swap that turns array order into flow
  // order for a right-hand round must not be applied twice.
  const previousUpperRound = isFolded || isLeftToRight ? relativePrevious : relativeNext;
  const nextUpperRound = isFolded || isLeftToRight ? relativeNext : relativePrevious;

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
  currentUpperRound: BracketRound<TRoundData, TMatchData>;
  previousUpperRound: BracketRound<TRoundData, TMatchData>;
  nextUpperRound: BracketRound<TRoundData, TMatchData> | null;
  /** The lower bracket as it is played, one round per depth - see `lowerFlow`. */
  lowerRounds: BracketRound<TRoundData, TMatchData>[];
  currentUpperRoundIndex: number;
  firstUpperRound: BracketRound<TRoundData, TMatchData>;
  firstLowerRound: BracketRound<TRoundData, TMatchData>;
  lastLowerRound: BracketRound<TRoundData, TMatchData>;
}) => {
  const {
    relations,
    currentUpperRound,
    previousUpperRound,
    nextUpperRound,
    lowerRounds,
    firstUpperRound,
    firstLowerRound,
    lastLowerRound,
  } = params;

  const finalLowerRound = lastLowerRound;
  const isAsyncBracket = nextUpperRound?.type === DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.REVERSE_FINAL;

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

    if (!preFinalLowerRound)
      throw new RuntimeError(BRACKET_ERROR_CODES.ROUND_RELATION_INVALID, 'preFinalLowerRound is null');

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
    const previousLowerRound = lowerRounds[lowerRounds.length - 2] || null;
    if (!previousLowerRound)
      throw new RuntimeError(BRACKET_ERROR_CODES.ROUND_RELATION_INVALID, 'previousLowerRound is null');
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
  currentUpperRound: BracketRound<TRoundData, TMatchData>;
  nextUpperRound: BracketRound<TRoundData, TMatchData>;
  lowerRounds: BracketRound<TRoundData, TMatchData>[];
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

  // Pairing "upper round at index i" with "lower round at index i" only means something while the upper
  // array is the outbound flow. A round on the way back from a fold sits past the finals in that array,
  // so its index would claim a lower round in the middle of the bracket and wire it as an opening round -
  // the loop at the end of `generateRoundRelations` reaches it by depth instead.
  if (currentLowerRound && nextLowerRound && !isFoldedBackRound(currentUpperRound)) {
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
  currentUpperRound: BracketRound<TRoundData, TMatchData>;
  previousUpperRound: BracketRound<TRoundData, TMatchData>;
  nextUpperRound: BracketRound<TRoundData, TMatchData>;
  lowerRounds: BracketRound<TRoundData, TMatchData>[];
  currentUpperRoundIndex: number;
  firstUpperRound: BracketRound<TRoundData, TMatchData>;
  firstLowerRound: BracketRound<TRoundData, TMatchData> | null;
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
    firstLowerRound &&
    // See `handleFirstRound`: an index into the outbound flow says nothing about a folded-back round.
    !isFoldedBackRound(currentUpperRound)
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
  bracketData: Bracket<TRoundData, TMatchData>,
): BracketRoundRelation<TRoundData, TMatchData>[] => {
  const relations: BracketRoundRelation<TRoundData, TMatchData>[] = [];

  const allRounds = [...bracketData.rounds.values()];
  const upperRounds = allRounds.filter((r) => r.type !== DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.LOWER_BRACKET);
  const lowerRounds = allRounds.filter((r) => r.type === DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.LOWER_BRACKET);

  const upperRoundsByDepth = buildRoundsByDepth(upperRounds);
  const lowerRoundsByDepth = buildRoundsByDepth(lowerRounds);

  // The lower bracket as it is *played*: one round per depth, taking the left half of a folded round.
  // A fold draws each early round twice, so the raw array holds two entries per depth and its last
  // element is a first-round half rather than the round that feeds the grand final. Unfolded, this is
  // the array itself.
  const lowerFlow = Array.from(lowerRoundsByDepth.keys())
    .sort((a, b) => a - b)
    .map((depth) => roundAtDepth({ byDepth: lowerRoundsByDepth, depth, side: null }))
    .filter((round) => !!round);

  const firstUpperRound = upperRounds[0];
  const firstLowerRound = lowerFlow[0] || null;
  const lastLowerRound = lowerFlow[lowerFlow.length - 1] || null;

  if (!firstUpperRound) throw new RuntimeError(BRACKET_ERROR_CODES.ROUND_RELATION_INVALID, 'No upper rounds found');

  const hasLowerRounds = lowerRounds.length > 0;

  for (const [currentUpperRoundIndex] of upperRounds.entries()) {
    const nav = getNavigationContext({
      upperRounds,
      upperRoundsByDepth,
      currentUpperRoundIndex,
    });

    if (nav.isFinal && hasLowerRounds && lastLowerRound && firstLowerRound && nav.previousUpperRound) {
      handleFinalRound({
        relations,
        currentUpperRound: nav.currentUpperRound,
        previousUpperRound: nav.previousUpperRound,
        nextUpperRound: nav.nextUpperRound,
        lowerRounds: lowerFlow,
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
        lowerRounds: lowerFlow,
        currentUpperRoundIndex,
      });
    } else if (nav.previousUpperRound && nav.nextUpperRound) {
      handleRegularRound({
        relations,
        currentUpperRound: nav.currentUpperRound,
        previousUpperRound: nav.previousUpperRound,
        nextUpperRound: nav.nextUpperRound,
        lowerRounds: lowerFlow,
        currentUpperRoundIndex,
        firstUpperRound,
        firstLowerRound,
      });
    }
  }

  if (hasLowerRounds && firstLowerRound) {
    const assignedRoundIds = new Set(relations.map((r) => r.currentRound.id));

    // By depth and side rather than by array position: in a folded bracket the array holds two rounds
    // per depth, so its neighbours are whatever was emitted alongside - for an unfolded one the two are
    // the same thing.
    for (const lowerRound of lowerRounds) {
      if (assignedRoundIds.has(lowerRound.id)) continue;

      const side = lowerRound.mirrorRoundType;
      const depth = lowerRound.logicalIndex;
      const prevLowerRound = roundAtDepth({ byDepth: lowerRoundsByDepth, depth: depth - 1, side });
      const nextLowerRound = roundAtDepth({ byDepth: lowerRoundsByDepth, depth: depth + 1, side });

      if (nextLowerRound) {
        if (!prevLowerRound) {
          relations.push(createNothingToOneRelation({ currentRound: lowerRound, nextRound: nextLowerRound }));
        } else {
          relations.push(
            createOneToOneRelation({
              currentRound: lowerRound,
              previousRound: prevLowerRound,
              nextRound: nextLowerRound,
              rootRound: firstLowerRound,
            }),
          );
        }
      } else if (prevLowerRound) {
        // Truncated bracket: the last lower round has no final round to feed into, so it terminates here.
        // In a complete bracket this round is wired up by handleFinalRound and already in assignedRoundIds.
        relations.push(
          createOneToNothingRelation({
            currentRound: lowerRound,
            previousRound: prevLowerRound,
            rootRound: firstLowerRound,
          }),
        );
      }
    }
  }

  return relations;
};
