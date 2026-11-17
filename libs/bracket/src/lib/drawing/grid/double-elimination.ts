import { COMMON_BRACKET_ROUND_TYPE, DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE } from '../../core';
import { Bracket, BracketRound } from '../../linked';
import {
  BracketComponents,
  BracketMasterColumnSection,
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
import { BRACKET_FINAL_ALIGNMENT, ComputedBracketGrid, CreateBracketGridConfig } from './types';
import { resolveBracketGridRowSpan } from './row-span';
import { buildSingleEliminationGrid } from './single-elimination';
import { createBracketGridSections, doubleEliminationRoundSection } from './sections';
import { BracketRuntimeError } from '../../bracket-runtime-error';
import { BRACKET_ERROR_CODES } from '../../bracket-errors';

const hasBothSides = <TRoundData, TMatchData>(bracketData: Bracket<TRoundData, TMatchData>) =>
  !!bracketData.roundsByType.get(DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.UPPER_BRACKET)?.first() &&
  !!bracketData.roundsByType.get(DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.LOWER_BRACKET)?.first();

const createOneSidedGrid = <TRoundData, TMatchData>(
  bracketData: Bracket<TRoundData, TMatchData>,
  options: CreateBracketGridConfig,
  components: BracketComponents<TRoundData, TMatchData>,
  // eslint-disable-next-line max-params -- grid builder signature (data, options, components)
): ComputedBracketGrid<TRoundData, TMatchData> => {
  const titleHeight = options.sectionTitleHeight ?? 0;
  const grid = buildSingleEliminationGrid(bracketData, options, components, titleHeight);

  return {
    ...grid,
    sections: createBracketGridSections({
      columns: grid.columns,
      sectionOf: doubleEliminationRoundSection,
      titleHeight,
      tops: { upper: titleHeight, lower: titleHeight, finals: titleHeight },
    }),
  };
};

export const createDoubleEliminationGrid = <TRoundData, TMatchData>(
  bracketData: Bracket<TRoundData, TMatchData>,
  options: CreateBracketGridConfig,
  components: BracketComponents<TRoundData, TMatchData>,
  // eslint-disable-next-line max-params -- grid builder signature (data, options, components)
): ComputedBracketGrid<TRoundData, TMatchData> => {
  if (!hasBothSides(bracketData)) return createOneSidedGrid(bracketData, options, components);

  const grid = buildDoubleEliminationGrid(bracketData, options, components, new Map());

  if (options.finalAlignment !== BRACKET_FINAL_ALIGNMENT.CENTER) return grid;

  return {
    ...buildDoubleEliminationGrid(bracketData, options, components, centeredFinalOffsets(bracketData, grid, options)),
    finalAlignment: BRACKET_FINAL_ALIGNMENT.CENTER,
  };
};

const matchBlock = <TRoundData, TMatchData>(
  grid: ComputedBracketGrid<TRoundData, TMatchData>,
  round: BracketRound<TRoundData, TMatchData> | null | undefined,
) => {
  if (!round) return null;

  let top = Infinity;
  let bottom = -Infinity;

  for (const match of round.matches.values()) {
    const element = grid.matchElementMap.get(match.id);

    if (!element) continue;

    top = Math.min(top, element.dimensions.top);
    bottom = Math.max(bottom, element.dimensions.top + element.dimensions.height);
  }

  return top <= bottom ? { top, bottom, center: (top + bottom) / 2 } : null;
};

const centeredFinalOffsets = <TRoundData, TMatchData>(
  bracketData: Bracket<TRoundData, TMatchData>,
  grid: ComputedBracketGrid<TRoundData, TMatchData>,
  options: CreateBracketGridConfig,
  // eslint-disable-next-line max-params -- (data, measured grid, options)
) => {
  const offsets = new Map<string, number>();
  const upperFinal = matchBlock(
    grid,
    bracketData.roundsByType.get(DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.UPPER_BRACKET)?.last(),
  );
  const lowerFinal = matchBlock(
    grid,
    bracketData.roundsByType.get(DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.LOWER_BRACKET)?.last(),
  );

  if (!upperFinal || !lowerFinal) return offsets;

  const target = (upperFinal.center + lowerFinal.center) / 2;
  const thirdPlace = matchBlock(grid, bracketData.roundsByType.get(COMMON_BRACKET_ROUND_TYPE.THIRD_PLACE)?.first());
  const finalRounds = [
    ...(bracketData.roundsByType.get(COMMON_BRACKET_ROUND_TYPE.FINAL)?.values() ?? []),
    ...(bracketData.roundsByType.get(DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.REVERSE_FINAL)?.values() ?? []),
  ];

  for (const round of finalRounds) {
    const final = matchBlock(grid, round);

    if (!final) continue;

    const offset = Math.max(0, target - final.center);
    const room = thirdPlace ? Math.max(0, thirdPlace.top - options.rowGap - final.bottom) : Infinity;

    offsets.set(round.id, Math.min(offset, room));
  }

  return offsets;
};

const buildDoubleEliminationGrid = <TRoundData, TMatchData>(
  bracketData: Bracket<TRoundData, TMatchData>,
  options: CreateBracketGridConfig,
  components: BracketComponents<TRoundData, TMatchData>,
  finalOffsets: ReadonlyMap<string, number>,
  // eslint-disable-next-line max-params -- grid builder signature plus the measured final offsets
): ComputedBracketGrid<TRoundData, TMatchData> => {
  const resolvedOptions = resolveBracketGridRowSpan(bracketData, options);
  const grid = createBracketGrid<TRoundData, TMatchData>({ spanElementWidth: resolvedOptions.columnWidth });
  const sectionTitleHeight = options.sectionTitleHeight ?? 0;

  const presentUpperBracketRounds = Array.from(
    bracketData.roundsByType.get(DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.UPPER_BRACKET)?.values() ?? [],
  );
  const lowerBracketRounds = Array.from(
    bracketData.roundsByType.get(DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.LOWER_BRACKET)?.values() ?? [],
  );

  // A complete winner bracket has (lowerRounds / 2) + 1 rounds. If fewer are present, the winner
  // bracket starts later than round 1 - e.g. a small double elimination where lower-round 1 is
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
    throw new BracketRuntimeError(
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
        options: resolvedOptions,
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
    const element = createBracketElement<TRoundData, TMatchData>({
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
    const element = createBracketElement<TRoundData, TMatchData>({
      area: '.',
      type: 'roundGap',
      elementHeight: options.rowRoundGap + sectionTitleHeight,
      partHeights: [options.rowRoundGap + sectionTitleHeight],
    });

    pushElement(element);

    return subColumn;
  };

  /** The band above the upper bracket and the finals that holds their section titles. */
  const pushSectionTitleBand = (pushSection: (section: BracketMasterColumnSection<TRoundData, TMatchData>) => void) => {
    if (!sectionTitleHeight) return;

    const { masterColumnSection, pushSubColumn } = createBracketMasterColumnSection<TRoundData, TMatchData>({
      type: 'gap',
    });
    const { subColumn, pushElement } = createBracketSubColumn<TRoundData, TMatchData>({
      span: { isStart: true, isEnd: true },
    });

    pushElement(
      createBracketElement<TRoundData, TMatchData>({
        area: '.',
        type: 'colGap',
        elementHeight: sectionTitleHeight,
        partHeights: [sectionTitleHeight],
      }),
    );
    pushSubColumn(subColumn);
    pushSection(masterColumnSection);
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
        throw new BracketRuntimeError(
          BRACKET_ERROR_CODES.GRID_INVALID,
          'Upper round not found for subColumnIndex: ' + subColumnIndex,
        );
      }

      // May be null for a leading winner slot that does not exist (front-truncated winner bracket).
      const upperRound = upperBracketRounds[currentUpperRoundIndex];

      const isUpperSpanStart = isFirstSubColumnInMasterColumn
        ? lowerRoundIndex === 0 || lastRoundLastSubColumnUpperIndex !== currentUpperRoundIndex
        : previousUpperRoundIndex !== currentUpperRoundIndex;

      const isUpperSpanEnd = isLastSubColumnInMasterColumn
        ? isLastLowerRound ||
          calculateUpperRoundIndex((lowerRoundIndex + 1) * columnSplitFactor, upperToLowerRatio, columnSplitFactor) !==
            currentUpperRoundIndex
        : nextUpperRoundIndex !== currentUpperRoundIndex;

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
        options: resolvedOptions,
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

    pushSectionTitleBand(pushSection);
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

    const finalOffset = finalOffsets.get(round.id) ?? 0;

    const { masterColumnSection: upperLowerGapSection, pushSubColumn: pushUpperLowerSubColumn } =
      createBracketMasterColumnSection<TRoundData, TMatchData>({
        type: 'gap',
        padding: finalOffset ? { top: -finalOffset, bottom: 0, left: 0, right: 0 } : undefined,
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
      options: resolvedOptions,
      hasReverseFinal,
      span: {
        isStart: true,
        isEnd: true,
      },
      components,
      topPadding: finalOffset,
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
      elementHeight: options.rowRoundGap + sectionTitleHeight,
      partHeights: [options.rowRoundGap + sectionTitleHeight],
    });

    upperLowerGapSubColumn.pushElement(upperLowerGapElement);

    pushUpperLowerSubColumn(upperLowerGapSubColumn.subColumn);

    if (thirdPlaceRound) {
      const lowerSubColumn = createRoundBracketSubColumnRelativeToFirstRound({
        firstRound: firstLowerRound,
        round: thirdPlaceRound,
        options: resolvedOptions,
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
        throw new BracketRuntimeError(BRACKET_ERROR_CODES.GRID_INVALID, 'No first master round found in grid');

      const lastMasterColumnSection = firstMasterRound.sections[firstMasterRound.sections.length - 1];

      if (!lastMasterColumnSection)
        throw new BracketRuntimeError(BRACKET_ERROR_CODES.GRID_INVALID, 'No last master column section found in grid');

      const firstSubColumn = lastMasterColumnSection.subColumns[0];

      if (!firstSubColumn)
        throw new BracketRuntimeError(BRACKET_ERROR_CODES.GRID_INVALID, 'No first sub column found in grid');

      for (const element of firstSubColumn.elements) {
        const el = createBracketElement<TRoundData, TMatchData>({
          area: '.',
          type: 'colGap',
          elementHeight: element.dimensions.height,
          partHeights: element.parts.map((p) => p.dimensions.height),
        });

        lowerSubColumn.pushElement(el);
      }

      pushLowerSubColumn(lowerSubColumn.subColumn);
    }

    pushSectionTitleBand(pushSection);
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
          headerOffset:
            sectionTitleHeight +
            (options.roundHeaderHeight > 0 ? options.roundHeaderHeight + options.roundHeaderGap : 0),
          component: components.continue,
          matches: continueMatches,
        }),
      );
    }
  }

  grid.setupElementSpans();
  grid.calculateDimensions();

  const finalizedGrid = finalizeBracketGrid(grid);
  const [upperRows, lowerRows] =
    grid.grid.masterColumns[0]?.sections.filter((section) => section.type === 'round') ?? [];

  return {
    raw: grid,
    columns: finalizedGrid.columns,
    matchElementMap: finalizedGrid.elementMap,
    sections: createBracketGridSections({
      columns: finalizedGrid.columns,
      sectionOf: doubleEliminationRoundSection,
      titleHeight: sectionTitleHeight,
      tops: {
        upper: upperRows?.dimensions.top,
        lower: lowerRows?.dimensions.top,
        finals: upperRows?.dimensions.top,
      },
    }),
  };
};
