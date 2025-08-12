import { DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE } from '../../core';
import { GenerateBracketGridDefinitionsOptions } from '../../grid-definitions';
import { NewBracket } from '../../linked';
import {
  createBracketElement,
  createBracketElementPart,
  createBracketGrid,
  createBracketMasterColumn,
  createBracketMasterColumnSection,
  createBracketSubColumn,
} from './core';
import {
  calculateColumnSplitFactor,
  calculateLowerRoundIndex,
  calculateUpperLowerRatio,
  calculateUpperRoundIndex,
} from './double-elimination-utils';
import { createBracketGapMasterColumnColumn, createRoundBracketSubColumnRelativeToFirstRound } from './prebuild';

export const createDoubleEliminationGrid = <TRoundData, TMatchData>(
  bracketData: NewBracket<TRoundData, TMatchData>,
  options: GenerateBracketGridDefinitionsOptions,
) => {
  const grid = createBracketGrid();

  const upperBracketRounds = Array.from(
    bracketData.roundsByType.getOrThrow(DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.UPPER_BRACKET).values(),
  );
  const lowerBracketRounds = Array.from(
    bracketData.roundsByType.getOrThrow(DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.LOWER_BRACKET).values(),
  );

  const remainingRounds = Array.from(bracketData.rounds.values()).filter(
    (r) =>
      r.type !== DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.UPPER_BRACKET &&
      r.type !== DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.LOWER_BRACKET,
  );

  console.log(remainingRounds);

  const firstUpperRound = upperBracketRounds[0];
  const firstLowerRound = lowerBracketRounds[0];

  if (!firstUpperRound || !firstLowerRound) {
    throw new Error('No upper or lower rounds found in bracket data');
  }

  const upperToLowerRatio = calculateUpperLowerRatio(upperBracketRounds.length, lowerBracketRounds.length);
  const columnSplitFactor = calculateColumnSplitFactor(upperToLowerRatio);

  let lastRoundLastSubColumnUpperIndex = -1;
  let lastRoundLastSubColumnLowerIndex = -1;

  for (const [lowerRoundIndex, lowerRound] of lowerBracketRounds.entries()) {
    const isLastLowerRound = lowerRoundIndex === lowerBracketRounds.length - 1;

    const { masterColumn, pushSection } = createBracketMasterColumn({
      columnWidth: options.columnWidth,
    });

    const { masterColumnSection: upperSection, pushSubColumn: pushUpperSubColumn } = createBracketMasterColumnSection({
      type: 'round',
    });

    const { masterColumnSection: upperLowerGapSection, pushSubColumn: pushUpperLowerSubColumn } =
      createBracketMasterColumnSection({
        type: 'gap',
      });

    const { masterColumnSection: lowerSection, pushSubColumn: pushLowerSubColumn } = createBracketMasterColumnSection({
      type: 'round',
    });

    for (let currentColumnSplitFactor = 1; currentColumnSplitFactor <= columnSplitFactor; currentColumnSplitFactor++) {
      const subColumnIndex = lowerRoundIndex * columnSplitFactor + (currentColumnSplitFactor - 1);

      const currentUpperRoundIndex = calculateUpperRoundIndex(subColumnIndex, upperToLowerRatio, columnSplitFactor);
      const currentLowerRoundIndex = lowerRoundIndex;

      const isFirstSubColumnInMasterColumn = currentColumnSplitFactor === 1;
      const isLastSubColumnInMasterColumn = currentColumnSplitFactor === columnSplitFactor;

      const previousSubColumnIndex = subColumnIndex - 1;
      const nextSubColumnIndex = subColumnIndex + 1;

      const previousUpperRoundIndex =
        previousSubColumnIndex >= 0
          ? calculateUpperRoundIndex(previousSubColumnIndex, upperToLowerRatio, columnSplitFactor)
          : -1;
      const nextUpperRoundIndex = calculateUpperRoundIndex(nextSubColumnIndex, upperToLowerRatio, columnSplitFactor);

      const previousLowerRoundIndex =
        previousSubColumnIndex >= 0 ? calculateLowerRoundIndex(previousSubColumnIndex, columnSplitFactor) : -1;
      const nextLowerRoundIndex = calculateLowerRoundIndex(nextSubColumnIndex, columnSplitFactor);

      const upperRound = upperBracketRounds[currentUpperRoundIndex];

      if (!upperRound) {
        throw new Error('Upper round not found for subColumnIndex: ' + subColumnIndex);
      }

      // For upper bracket spans - check if this round is different from the previous occurrence
      const isUpperSpanStart = isFirstSubColumnInMasterColumn
        ? lowerRoundIndex === 0 || lastRoundLastSubColumnUpperIndex !== currentUpperRoundIndex
        : previousUpperRoundIndex !== currentUpperRoundIndex;

      // For upper bracket spans - check if this round will be different in the next occurrence
      const isUpperSpanEnd = isLastSubColumnInMasterColumn
        ? isLastLowerRound ||
          calculateUpperRoundIndex((lowerRoundIndex + 1) * columnSplitFactor, upperToLowerRatio, columnSplitFactor) !==
            currentUpperRoundIndex
        : nextUpperRoundIndex !== currentUpperRoundIndex;

      // For lower bracket spans - similar logic
      const isLowerSpanStart = isFirstSubColumnInMasterColumn
        ? lowerRoundIndex === 0 || lastRoundLastSubColumnLowerIndex !== currentLowerRoundIndex
        : previousLowerRoundIndex !== currentLowerRoundIndex;

      const isLowerSpanEnd = isLastSubColumnInMasterColumn
        ? isLastLowerRound ||
          calculateLowerRoundIndex((lowerRoundIndex + 1) * columnSplitFactor, columnSplitFactor) !==
            currentLowerRoundIndex
        : nextLowerRoundIndex !== currentLowerRoundIndex;

      const upperSubColumn = createRoundBracketSubColumnRelativeToFirstRound({
        firstRound: firstUpperRound,
        round: upperRound,
        options,
        span: {
          isStart: isUpperSpanStart,
          isEnd: isUpperSpanEnd,
        },
      });

      pushUpperSubColumn(upperSubColumn);

      const upperLowerGapSubColumn = createBracketSubColumn({
        span: {
          isStart: true,
          isEnd: true,
        },
      });

      const upperLowerGapElement = createBracketElement({
        area: '.',
        type: 'roundGap',
        elementHeight: options.upperLowerGap,
      });

      const upperLowerGapElementPart = createBracketElementPart({
        elementPartHeight: options.upperLowerGap,
      });

      upperLowerGapElement.pushPart(upperLowerGapElementPart.elementPart);
      upperLowerGapSubColumn.pushElement(upperLowerGapElement.element);

      pushUpperLowerSubColumn(upperLowerGapSubColumn.subColumn);

      const lowerSubColumn = createRoundBracketSubColumnRelativeToFirstRound({
        firstRound: firstLowerRound,
        round: lowerRound,
        options,
        span: {
          isStart: isLowerSpanStart,
          isEnd: isLowerSpanEnd,
        },
      });

      pushLowerSubColumn(lowerSubColumn);

      if (isLastSubColumnInMasterColumn) {
        lastRoundLastSubColumnUpperIndex = currentUpperRoundIndex;
        lastRoundLastSubColumnLowerIndex = currentLowerRoundIndex;
      }
    }

    pushSection(upperSection, upperLowerGapSection, lowerSection);

    grid.pushMasterColumn(masterColumn);

    if (remainingRounds.length) {
      grid.pushMasterColumn(
        createBracketGapMasterColumnColumn({
          existingMasterColumns: grid.grid.masterColumns,
          columnGap: options.columnGap,
        }),
      );
    }
  }

  // TODO: There is only a final round left
  // Maybe also a reverse final and third place
  // But those should result in specific layouts
  // So we should probably build explicit functions for those cases
  // Maybe just one function that takes in the existing grid and an array of rounds as params
  // Returning a bracket master column containing the rounds
  // the rounds should be centered in the column
  // see https://miro.medium.com/v2/resize:fit:1400/1*mcVk_eZ4WUsiMOSuUlrbrA.png
  for (const [roundIndex, round] of remainingRounds.entries()) {
    const isLastRound = roundIndex === remainingRounds.length - 1;

    const { masterColumn, pushSection } = createBracketMasterColumn({
      columnWidth: options.columnWidth,
    });

    const { masterColumnSection, pushSubColumn } = createBracketMasterColumnSection({
      type: 'round',
    });

    const subColumn = createRoundBracketSubColumnRelativeToFirstRound({
      firstRound: firstUpperRound,
      round,
      options,
      span: {
        isStart: true,
        isEnd: true,
      },
    });

    pushSubColumn(subColumn);

    pushSection(masterColumnSection);

    grid.pushMasterColumn(masterColumn);

    if (!isLastRound) {
      grid.pushMasterColumn(
        createBracketGapMasterColumnColumn({
          existingMasterColumns: grid.grid.masterColumns,
          columnGap: options.columnGap,
        }),
      );
    }
  }

  grid.calculateDimensions();

  return grid;
};
