import { COMMON_BRACKET_ROUND_TYPE } from '../../core';
import { Bracket, BracketRound } from '../../linked';
import {
  BracketComponents,
  BracketSubColumn,
  createBracketGrid,
  createBracketMasterColumn,
  createBracketMasterColumnSection,
  BracketMasterColumnSection,
  finalizeBracketGrid,
} from './core';
import {
  createBracketContinueMasterColumn,
  createBracketGapMasterColumn,
  createFoldedThirdPlaceSection,
  createRoundBracketSubColumnRelativeToFirstRound,
  getBracketContinueMatches,
} from './prebuild';
import { ComputedBracketGrid, CreateBracketGridConfig } from './types';
import { resolveBracketGridRowSpan } from './row-span';
import { BracketRuntimeError } from '../../bracket-runtime-error';
import { BRACKET_ERROR_CODES } from '../../bracket-errors';

const resolveFoldedThirdPlaceRound = <TRoundData, TMatchData>(
  rounds: BracketRound<TRoundData, TMatchData>[],
  options: CreateBracketGridConfig,
) => {
  if (options.thirdPlaceTopOffset === null || options.thirdPlaceTopOffset === undefined) return null;
  if (!rounds.some((round) => round.type === COMMON_BRACKET_ROUND_TYPE.FINAL)) return null;

  return rounds.find((round) => round.type === COMMON_BRACKET_ROUND_TYPE.THIRD_PLACE) ?? null;
};

export const createSingleEliminationGrid = <TRoundData, TMatchData>(
  bracketData: Bracket<TRoundData, TMatchData>,
  options: CreateBracketGridConfig,
  components: BracketComponents<TRoundData, TMatchData>,
  // eslint-disable-next-line max-params -- grid builder signature (data, options, components)
): ComputedBracketGrid<TRoundData, TMatchData> => {
  const grid = createBracketGrid<TRoundData, TMatchData>({ spanElementWidth: options.columnWidth });
  const rounds = Array.from(bracketData.rounds.values());
  const firstRound = bracketData.rounds.first();

  if (!firstRound) {
    throw new BracketRuntimeError(BRACKET_ERROR_CODES.SOURCE_EMPTY, 'No rounds found in bracket data');
  }

  const resolvedOptions = resolveBracketGridRowSpan(bracketData, options);
  const foldedThirdPlaceRound = resolveFoldedThirdPlaceRound(rounds, options);
  const columnRounds = rounds.filter((round) => round !== foldedThirdPlaceRound);

  let pushSectionToFinal: ((...sections: BracketMasterColumnSection<TRoundData, TMatchData>[]) => void) | null = null;
  let finalSubColumn: BracketSubColumn<TRoundData, TMatchData> | null = null;

  for (const [roundIndex, round] of columnRounds.entries()) {
    const isLastRound = roundIndex === columnRounds.length - 1;
    const isFinalRound = round.type === COMMON_BRACKET_ROUND_TYPE.FINAL;
    const { masterColumn, ...mutableMasterColumn } = createBracketMasterColumn<TRoundData, TMatchData>({
      columnWidth: isFinalRound ? options.finalColumnWidth : options.columnWidth,
      padding: {
        bottom: 0,
        left: 0,
        right: 0,
        top: 0,
      },
    });

    const { masterColumnSection, pushSubColumn } = createBracketMasterColumnSection<TRoundData, TMatchData>({
      type: 'round',
    });

    const sub = createRoundBracketSubColumnRelativeToFirstRound({
      firstRound,
      round,
      options: resolvedOptions,
      hasReverseFinal: false,
      span: {
        isStart: true,
        isEnd: true,
      },
      components,
    });
    pushSubColumn(sub);

    mutableMasterColumn.pushSection(masterColumnSection);

    grid.pushMasterColumn(masterColumn);

    if (isFinalRound) {
      pushSectionToFinal = mutableMasterColumn.pushSection;
      finalSubColumn = sub;
    }

    if (!isLastRound) {
      grid.pushMasterColumn(
        createBracketGapMasterColumn({
          existingMasterColumns: grid.grid.masterColumns,
          columnGap: options.columnGap,
        }),
      );
    }
  }

  // After the loop, so the gap column beside the final mirrors the final's section alone: the folded
  // round has nothing to its right to stay aligned with.
  if (foldedThirdPlaceRound && pushSectionToFinal && finalSubColumn) {
    pushSectionToFinal(
      createFoldedThirdPlaceSection({
        finalSubColumn,
        round: foldedThirdPlaceRound,
        topOffset: options.thirdPlaceTopOffset ?? 0,
        options: resolvedOptions,
        components,
      }),
    );
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

  grid.calculateDimensions();

  const finalizedGrid = finalizeBracketGrid(grid);

  return {
    raw: grid,
    columns: finalizedGrid.columns,
    matchElementMap: finalizedGrid.elementMap,
  };
};
