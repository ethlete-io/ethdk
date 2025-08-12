import { COMMON_BRACKET_ROUND_TYPE, DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE } from '../../core';
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
import { createBracketGapMasterColumn, createRoundBracketSubColumnRelativeToFirstRound } from './prebuild';

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
      r.type !== DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.LOWER_BRACKET &&
      r.type !== COMMON_BRACKET_ROUND_TYPE.THIRD_PLACE,
  );

  const thirdPlaceRound = bracketData.roundsByType.get(COMMON_BRACKET_ROUND_TYPE.THIRD_PLACE)?.first() ?? null;
  const hasReverseFinal = !!bracketData.roundsByType.get(DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.REVERSE_FINAL)?.first();

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
        hasReverseFinal,
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
        hasReverseFinal,
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
        createBracketGapMasterColumn({
          existingMasterColumns: grid.grid.masterColumns,
          columnGap: options.columnGap,
        }),
      );
    }
  }

  for (const [roundIndex, round] of remainingRounds.entries()) {
    const isLastRound = roundIndex === remainingRounds.length - 1;
    const isFirstRound = roundIndex === 0;

    const isAnyFinal = hasReverseFinal
      ? round.type === DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.REVERSE_FINAL
      : round.type === COMMON_BRACKET_ROUND_TYPE.FINAL;

    const { masterColumn, pushSection } = createBracketMasterColumn({
      columnWidth: isAnyFinal ? options.finalColumnWidth : options.columnWidth,
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

    const upperSubColumn = createRoundBracketSubColumnRelativeToFirstRound({
      firstRound: firstUpperRound,
      round,
      options,
      hasReverseFinal,
      span: {
        isStart: true,
        isEnd: true,
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

    if (thirdPlaceRound) {
      const lowerSubColumn = createRoundBracketSubColumnRelativeToFirstRound({
        firstRound: firstLowerRound,
        round: thirdPlaceRound,
        options,
        hasReverseFinal,
        span: {
          isStart: isFirstRound,
          isEnd: isLastRound,
        },
      });

      pushLowerSubColumn(lowerSubColumn);
    } else {
      const lowerSubColumn = createBracketSubColumn({
        span: {
          isStart: true,
          isEnd: true,
        },
      });

      const firstMasterRound = grid.grid.masterColumns[0];

      if (!firstMasterRound) throw new Error('No first master round found in grid');

      const lastMasterColumnSection = firstMasterRound.sections[firstMasterRound.sections.length - 1];

      if (!lastMasterColumnSection) throw new Error('No last master column section found in grid');

      const firstSubColumn = lastMasterColumnSection.subColumns[0];

      if (!firstSubColumn) throw new Error('No first sub column found in grid');

      for (const element of firstSubColumn.elements) {
        const el = createBracketElement({
          area: '.',
          type: 'colGap',
          elementHeight: element.dimensions.height,
        });

        for (const part of element.parts) {
          const elPart = createBracketElementPart({
            elementPartHeight: part.dimensions.height,
          });

          el.pushPart(elPart.elementPart);
        }

        lowerSubColumn.pushElement(el.element);
      }

      pushLowerSubColumn(lowerSubColumn.subColumn);
    }

    pushSection(upperSection, upperLowerGapSection, lowerSection);

    grid.pushMasterColumn(masterColumn);

    if (!isLastRound) {
      grid.pushMasterColumn(
        createBracketGapMasterColumn({
          existingMasterColumns: grid.grid.masterColumns,
          columnGap: options.columnGap,
        }),
      );
    }
  }

  grid.calculateDimensions();

  return grid;
};
