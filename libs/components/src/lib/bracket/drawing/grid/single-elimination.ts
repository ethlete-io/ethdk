import { COMMON_BRACKET_ROUND_TYPE } from '../../core';
import { Bracket } from '../../linked';
import {
  BracketComponents,
  createBracketGrid,
  createBracketMasterColumn,
  createBracketMasterColumnSection,
  finalizeBracketGrid,
} from './core';
import {
  createBracketContinueMasterColumn,
  createBracketGapMasterColumn,
  createRoundBracketSubColumnRelativeToFirstRound,
  getBracketContinueMatches,
} from './prebuild';
import { ComputedBracketGrid, CreateBracketGridConfig } from './types';
import { RuntimeError } from '@ethlete/core';
import { BRACKET_ERROR_CODES } from '../../bracket-errors';

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
    throw new RuntimeError(BRACKET_ERROR_CODES.SOURCE_EMPTY, 'No rounds found in bracket data');
  }

  for (const [roundIndex, round] of rounds.entries()) {
    const isLastRound = roundIndex === rounds.length - 1;
    const { masterColumn, ...mutableMasterColumn } = createBracketMasterColumn<TRoundData, TMatchData>({
      columnWidth: round.type === COMMON_BRACKET_ROUND_TYPE.FINAL ? options.finalColumnWidth : options.columnWidth,
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
      options,
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

  grid.calculateDimensions();

  const finalizedGrid = finalizeBracketGrid(grid);

  return {
    raw: grid,
    columns: finalizedGrid.columns,
    matchElementMap: finalizedGrid.elementMap,
  };
};
