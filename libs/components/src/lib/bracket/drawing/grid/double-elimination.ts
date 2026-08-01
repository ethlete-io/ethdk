import { COMMON_BRACKET_ROUND_TYPE, DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE } from '../../core';
import { Bracket, BracketRound } from '../../linked';
import {
  BracketComponents,
  BracketSubColumnSpan,
  createBracketElement,
  createBracketGrid,
  createBracketMasterColumn,
  createBracketMasterColumnSection,
  createBracketSubColumn,
  finalizeBracketGrid,
} from './core';
import {
  calculateColumnSplitFactor,
  calculateLowerRoundIndex,
  calculateUpperLowerRatio,
  calculateUpperRoundIndex,
} from './double-elimination-utils';
import {
  createBracketContinueMasterColumn,
  createBracketGapMasterColumn,
  createRoundBracketSubColumnRelativeToFirstRound,
  getBracketContinueMatches,
} from './prebuild';
import { ComputedBracketGrid, CreateBracketGridConfig } from './types';
import { RuntimeError } from '@ethlete/core';
import { BRACKET_ERROR_CODES } from '../../bracket-errors';

export const createDoubleEliminationGrid = <TRoundData, TMatchData>(
  bracketData: Bracket<TRoundData, TMatchData>,
  options: CreateBracketGridConfig,
  components: BracketComponents<TRoundData, TMatchData>,
  // eslint-disable-next-line max-params -- grid builder signature (data, options, components)
): ComputedBracketGrid<TRoundData, TMatchData> => {
  const grid = createBracketGrid<TRoundData, TMatchData>({ spanElementWidth: options.columnWidth });

  const presentUpperBracketRounds = Array.from(
    bracketData.roundsByType.getOrThrow(DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.UPPER_BRACKET).values(),
  );
  const lowerBracketRounds = Array.from(
    bracketData.roundsByType.getOrThrow(DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.LOWER_BRACKET).values(),
  );

  // A complete winner bracket has (lowerRounds / 2) + 1 rounds. If fewer are present, the winner
  // bracket starts later than round 1 — e.g. a small double elimination where lower-round 1 is
  // seeded directly from a group phase and has no winner round feeding it. Pad the front of the
  // winner rounds with nulls so the column mapping keeps treating the winner bracket as complete:
  // the missing early rounds become empty slots above the lower rounds they never fed, and every
  // present winner round lines up above its real drop-in lower round.
  const fullUpperRoundCount = Math.floor(lowerBracketRounds.length / 2) + 1;
  const frontMissingUpperRounds = Math.max(0, fullUpperRoundCount - presentUpperBracketRounds.length);
  const upperBracketRounds: (BracketRound<TRoundData, TMatchData> | null)[] = [
    ...Array.from({ length: frontMissingUpperRounds }, () => null),
    ...presentUpperBracketRounds,
  ];

  const remainingRounds = Array.from(bracketData.rounds.values()).filter(
    (r) =>
      r.type !== DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.UPPER_BRACKET &&
      r.type !== DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.LOWER_BRACKET &&
      r.type !== COMMON_BRACKET_ROUND_TYPE.THIRD_PLACE,
  );

  const thirdPlaceRound = bracketData.roundsByType.get(COMMON_BRACKET_ROUND_TYPE.THIRD_PLACE)?.first() ?? null;
  const hasReverseFinal = !!bracketData.roundsByType.get(DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.REVERSE_FINAL)?.first();

  const firstUpperRound = presentUpperBracketRounds[0];
  const firstLowerRound = lowerBracketRounds[0];

  if (!firstUpperRound || !firstLowerRound) {
    throw new RuntimeError(
      BRACKET_ERROR_CODES.ROUND_RELATION_INVALID,
      'No upper or lower rounds found in bracket data',
    );
  }

  const upperToLowerRatio = calculateUpperLowerRatio(upperBracketRounds.length, lowerBracketRounds.length);
  const columnSplitFactor = calculateColumnSplitFactor(upperToLowerRatio);

  /**
   * The winner-bracket half of one column, or the space it would have taken. A front-truncated winner
   * bracket has leading slots with no round in them; reserving their height keeps the lower rounds below
   * aligned with the winner rounds that do exist.
   */
  const createUpperBracketSubColumn = (config: {
    round: BracketRound<TRoundData, TMatchData> | null;
    span: BracketSubColumnSpan;
  }) => {
    if (config.round) {
      return createRoundBracketSubColumnRelativeToFirstRound({
        firstRound: firstUpperRound,
        round: config.round,
        options,
        hasReverseFinal,
        span: config.span,
        components,
      });
    }

    const emptyUpperHeight =
      (options.roundHeaderHeight > 0 ? options.roundHeaderHeight + options.roundHeaderGap : 0) +
      firstUpperRound.matchCount * options.matchHeight +
      Math.max(0, firstUpperRound.matchCount - 1) * options.rowGap;

    const { subColumn, pushElement } = createBracketSubColumn<TRoundData, TMatchData>({ span: config.span });
    const { element } = createBracketElement<TRoundData, TMatchData>({
      area: '.',
      type: 'colGap',
      elementHeight: emptyUpperHeight,
      partHeights: [emptyUpperHeight],
    });

    pushElement(element);

    return subColumn;
  };

  /** The breathing room between the winner and loser halves of a column. */
  const createUpperLowerGapSubColumn = () => {
    const { subColumn, pushElement } = createBracketSubColumn<TRoundData, TMatchData>({
      span: { isStart: true, isEnd: true },
    });
    const { element } = createBracketElement<TRoundData, TMatchData>({
      area: '.',
      type: 'roundGap',
      elementHeight: options.rowRoundGap,
      partHeights: [options.rowRoundGap],
    });

    pushElement(element);

    return subColumn;
  };

  let lastRoundLastSubColumnUpperIndex = -1;
  let lastRoundLastSubColumnLowerIndex = -1;

  for (const [lowerRoundIndex, lowerRound] of lowerBracketRounds.entries()) {
    const isLastLowerRound = lowerRoundIndex === lowerBracketRounds.length - 1;

    const { masterColumn, pushSection } = createBracketMasterColumn<TRoundData, TMatchData>({
      columnWidth: options.columnWidth,
      padding: {
        bottom: 0,
        left: 0,
        right: 0,
        top: 0,
      },
    });

    const { masterColumnSection: upperSection, pushSubColumn: pushUpperSubColumn } = createBracketMasterColumnSection<
      TRoundData,
      TMatchData
    >({
      type: 'round',
    });

    const { masterColumnSection: upperLowerGapSection, pushSubColumn: pushUpperLowerSubColumn } =
      createBracketMasterColumnSection<TRoundData, TMatchData>({
        type: 'gap',
      });

    const { masterColumnSection: lowerSection, pushSubColumn: pushLowerSubColumn } = createBracketMasterColumnSection<
      TRoundData,
      TMatchData
    >({
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

      if (currentUpperRoundIndex < 0 || currentUpperRoundIndex >= upperBracketRounds.length) {
        throw new RuntimeError(
          BRACKET_ERROR_CODES.GRID_INVALID,
          'Upper round not found for subColumnIndex: ' + subColumnIndex,
        );
      }

      // May be null for a leading winner slot that does not exist (front-truncated winner bracket).
      const upperRound = upperBracketRounds[currentUpperRoundIndex];

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

      const upperSpan = { isStart: isUpperSpanStart, isEnd: isUpperSpanEnd };

      pushUpperSubColumn(createUpperBracketSubColumn({ round: upperRound ?? null, span: upperSpan }));
      pushUpperLowerSubColumn(createUpperLowerGapSubColumn());

      const lowerSubColumn = createRoundBracketSubColumnRelativeToFirstRound({
        firstRound: firstLowerRound,
        round: lowerRound,
        options,
        hasReverseFinal,
        span: {
          isStart: isLowerSpanStart,
          isEnd: isLowerSpanEnd,
        },
        components,
      });

      pushLowerSubColumn(lowerSubColumn);

      if (isLastSubColumnInMasterColumn) {
        lastRoundLastSubColumnUpperIndex = currentUpperRoundIndex;
        lastRoundLastSubColumnLowerIndex = currentLowerRoundIndex;
      }
    }

    pushSection(upperSection, upperLowerGapSection, lowerSection);

    grid.pushMasterColumn(masterColumn);

    // Always separate consecutive lower rounds with a gap column. The trailing gap after the
    // last lower round is only needed to connect to the finals section (remainingRounds); in a
    // truncated bracket without a final we must still gap the intermediate rounds, otherwise the
    // rounds sit flush against each other and their connector lines collapse to zero width.
    if (!isLastLowerRound || remainingRounds.length) {
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

    const { masterColumn, pushSection } = createBracketMasterColumn<TRoundData, TMatchData>({
      columnWidth: isAnyFinal ? options.finalColumnWidth : options.columnWidth,
      padding: {
        bottom: 0,
        left: 0,
        right: 0,
        top: 0,
      },
    });

    const { masterColumnSection: upperSection, pushSubColumn: pushUpperSubColumn } = createBracketMasterColumnSection<
      TRoundData,
      TMatchData
    >({
      type: 'round',
    });

    const { masterColumnSection: upperLowerGapSection, pushSubColumn: pushUpperLowerSubColumn } =
      createBracketMasterColumnSection<TRoundData, TMatchData>({
        type: 'gap',
      });

    const { masterColumnSection: lowerSection, pushSubColumn: pushLowerSubColumn } = createBracketMasterColumnSection<
      TRoundData,
      TMatchData
    >({
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
      components,
    });

    pushUpperSubColumn(upperSubColumn);

    const upperLowerGapSubColumn = createBracketSubColumn<TRoundData, TMatchData>({
      span: {
        isStart: true,
        isEnd: true,
      },
    });

    const upperLowerGapElement = createBracketElement<TRoundData, TMatchData>({
      area: '.',
      type: 'roundGap',
      elementHeight: options.rowRoundGap,
      partHeights: [options.rowRoundGap],
    });

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
        components,
      });

      pushLowerSubColumn(lowerSubColumn);
    } else {
      const lowerSubColumn = createBracketSubColumn<TRoundData, TMatchData>({
        span: {
          isStart: true,
          isEnd: true,
        },
      });

      const firstMasterRound = grid.grid.masterColumns[0];

      if (!firstMasterRound)
        throw new RuntimeError(BRACKET_ERROR_CODES.GRID_INVALID, 'No first master round found in grid');

      const lastMasterColumnSection = firstMasterRound.sections[firstMasterRound.sections.length - 1];

      if (!lastMasterColumnSection)
        throw new RuntimeError(BRACKET_ERROR_CODES.GRID_INVALID, 'No last master column section found in grid');

      const firstSubColumn = lastMasterColumnSection.subColumns[0];

      if (!firstSubColumn)
        throw new RuntimeError(BRACKET_ERROR_CODES.GRID_INVALID, 'No first sub column found in grid');

      for (const element of firstSubColumn.elements) {
        const el = createBracketElement<TRoundData, TMatchData>({
          area: '.',
          type: 'colGap',
          elementHeight: element.dimensions.height,
          partHeights: element.parts.map((p) => p.dimensions.height),
        });

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

  if (options.continueElement && components.continue) {
    const continueMatches = getBracketContinueMatches(bracketData);

    if (continueMatches.length) {
      grid.pushMasterColumn(
        createBracketGapMasterColumn({
          existingMasterColumns: grid.grid.masterColumns,
          columnGap: options.columnGap,
        }),
      );

      grid.pushMasterColumn(
        createBracketContinueMasterColumn({
          existingMasterColumns: grid.grid.masterColumns,
          columnWidth: options.continueElement.columnWidth,
          elementHeight: options.continueElement.elementHeight,
          headerOffset: options.roundHeaderHeight > 0 ? options.roundHeaderHeight + options.roundHeaderGap : 0,
          component: components.continue,
          matches: continueMatches,
        }),
      );
    }
  }

  grid.setupElementSpans();
  grid.calculateDimensions();

  const finalizedGrid = finalizeBracketGrid(grid);

  return {
    raw: grid,
    columns: finalizedGrid.columns,
    matchElementMap: finalizedGrid.elementMap,
  };
};
