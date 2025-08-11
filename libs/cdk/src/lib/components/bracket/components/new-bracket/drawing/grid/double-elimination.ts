import { DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE } from '../../core';
import { GenerateBracketGridDefinitionsOptions } from '../../grid-definitions';
import { NewBracket } from '../../linked';
import { BracketMasterColumn, createBracketMasterColumn, createBracketMasterColumnSection } from './core';
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
  const grid: BracketMasterColumn[] = [];

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

  // Example: 1.5 means that for every 1 upper round, there are 1.5 lower rounds
  // In a double elimination bracket, it will always be either 1.5 or 2. 2 means that the bracket only displays a part of the complete tournament
  const upperToLowerRatio = calculateUpperLowerRatio(upperBracketRounds.length, lowerBracketRounds.length);
  const columnSplitFactor = calculateColumnSplitFactor(upperToLowerRatio);

  for (const [lowerRoundIndex, lowerRound] of lowerBracketRounds.entries()) {
    const { masterColumn, pushSection } = createBracketMasterColumn({
      columnWidth: options.columnWidth,
      existingMasterColumns: grid,
    });

    const { masterColumnSection: upperSection, pushSubColumn: pushUpperSubColumn } = createBracketMasterColumnSection({
      masterColumn,
      type: 'round',
    });

    for (let currentColumnSplitFactor = 1; currentColumnSplitFactor <= columnSplitFactor; currentColumnSplitFactor++) {
      const subColumnIndex = lowerRoundIndex * columnSplitFactor;
      const upperRoundIndex = calculateUpperRoundIndex(subColumnIndex, upperToLowerRatio, columnSplitFactor);

      const previousUpperRoundIndex = calculateUpperRoundIndex(
        subColumnIndex - 1,
        upperToLowerRatio,
        columnSplitFactor,
      );
      const nextUpperRoundIndex = calculateUpperRoundIndex(subColumnIndex + 1, upperToLowerRatio, columnSplitFactor);

      const upperRound = upperBracketRounds[upperRoundIndex];

      if (!upperRound) {
        throw new Error('Upper round not found for subColumnIndex: ' + subColumnIndex);
      }

      const isUpperSpanStart = previousUpperRoundIndex !== upperRoundIndex;
      const isUpperSpanEnd = nextUpperRoundIndex !== upperRoundIndex;

      const upperSubColumn = createRoundBracketSubColumn({
        firstRound: firstUpperRound,
        round: upperRound,
        masterColumn,
        masterColumnSection: upperSection,
        options,
        totalSubColumns: columnSplitFactor,
        span: {
          isStart: isUpperSpanStart,
          isEnd: isUpperSpanEnd,
        },
        isFirstSubColumn: currentColumnSplitFactor === 1,
      });

      pushUpperSubColumn(upperSubColumn);
    }

    pushSection(upperSection);

    const { masterColumnSection: lowerSection, pushSubColumn: pushLowerSubColumn } = createBracketMasterColumnSection({
      masterColumn,
      type: 'round',
    });

    for (let currentColumnSplitFactor = 1; currentColumnSplitFactor <= columnSplitFactor; currentColumnSplitFactor++) {
      const subColumnIndex = lowerRoundIndex * columnSplitFactor;
      const previousLowerRoundIndex = calculateLowerRoundIndex(subColumnIndex - 1, columnSplitFactor);
      const nextLowerRoundIndex = calculateLowerRoundIndex(subColumnIndex + 1, columnSplitFactor);

      const isLowerSpanStart = previousLowerRoundIndex !== lowerRoundIndex;
      const isLowerSpanEnd = nextLowerRoundIndex !== lowerRoundIndex;

      const lowerSubColumn = createRoundBracketSubColumn({
        firstRound: firstLowerRound,
        round: lowerRound,
        masterColumn,
        masterColumnSection: lowerSection,
        options,
        totalSubColumns: columnSplitFactor,
        span: {
          isStart: isLowerSpanStart,
          isEnd: isLowerSpanEnd,
        },
        isFirstSubColumn: currentColumnSplitFactor === 1,
      });

      pushLowerSubColumn(lowerSubColumn);
    }

    pushSection(lowerSection);

    grid.push(masterColumn);
  }

  return grid;
};
