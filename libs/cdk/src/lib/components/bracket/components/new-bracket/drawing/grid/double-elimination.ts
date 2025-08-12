import { DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE } from '../../core';
import { GenerateBracketGridDefinitionsOptions } from '../../grid-definitions';
import { NewBracket } from '../../linked';
import {
  createBracketElement,
  createBracketElementPart,
  createBracketGapMasterColumnColumn,
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
import { createRoundBracketSubColumn } from './single-elimination';

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

  const firstUpperRound = upperBracketRounds[0];
  const firstLowerRound = lowerBracketRounds[0];

  if (!firstUpperRound || !firstLowerRound) {
    throw new Error('No upper or lower rounds found in bracket data');
  }

  const upperToLowerRatio = calculateUpperLowerRatio(upperBracketRounds.length, lowerBracketRounds.length);
  const columnSplitFactor = calculateColumnSplitFactor(upperToLowerRatio);

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

      const upperRoundIndex = calculateUpperRoundIndex(subColumnIndex, upperToLowerRatio, columnSplitFactor);
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

      const upperRound = upperBracketRounds[upperRoundIndex];

      if (!upperRound) {
        throw new Error('Upper round not found for subColumnIndex: ' + subColumnIndex);
      }

      const isUpperSpanStart = previousUpperRoundIndex !== upperRoundIndex || isFirstSubColumnInMasterColumn;
      const isUpperSpanEnd = nextUpperRoundIndex !== upperRoundIndex || isLastSubColumnInMasterColumn;
      const isLowerSpanStart = previousLowerRoundIndex !== currentLowerRoundIndex || isFirstSubColumnInMasterColumn;
      const isLowerSpanEnd = nextLowerRoundIndex !== currentLowerRoundIndex || isLastSubColumnInMasterColumn;

      console.log(`SPLIT: ${currentColumnSplitFactor}`, {
        prev: {
          upper: previousUpperRoundIndex,
          lower: previousLowerRoundIndex,
          subColumnIndex: previousSubColumnIndex,
        },
        next: {
          upper: nextUpperRoundIndex,
          lower: nextLowerRoundIndex,
          subColumnIndex: nextSubColumnIndex,
        },
        curr: {
          upper: upperRoundIndex,
          lower: currentLowerRoundIndex,
          subColumnIndex,
        },
        upperToLowerRatio,
        columnSplitFactor,
        isUpperSpanStart,
        isUpperSpanEnd,
        isLowerSpanStart,
        isLowerSpanEnd,
        masterColumn,
      });

      const upperSubColumn = createRoundBracketSubColumn({
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

      const lowerSubColumn = createRoundBracketSubColumn({
        firstRound: firstLowerRound,
        round: lowerRound,
        options,
        span: {
          isStart: isLowerSpanStart,
          isEnd: isLowerSpanEnd,
        },
      });

      pushLowerSubColumn(lowerSubColumn);
    }

    pushSection(upperSection, upperLowerGapSection, lowerSection);

    grid.pushMasterColumn(masterColumn);

    if (!isLastLowerRound) {
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
