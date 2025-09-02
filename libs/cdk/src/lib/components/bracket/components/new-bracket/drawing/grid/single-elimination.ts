import { COMMON_BRACKET_ROUND_TYPE } from '../../core';
import { GenerateBracketGridDefinitionsOptions } from '../../grid-definitions';
import { NewBracket } from '../../linked';
import { createBracketGrid, createBracketMasterColumn, createBracketMasterColumnSection } from './core';
import {
  BracketComponents,
  createBracketGapMasterColumn,
  createRoundBracketSubColumnRelativeToFirstRound,
} from './prebuild';

export const createSingleEliminationGrid = <TRoundData, TMatchData>(
  bracketData: NewBracket<TRoundData, TMatchData>,
  options: GenerateBracketGridDefinitionsOptions,
  components: BracketComponents<TRoundData, TMatchData>,
) => {
  const grid = createBracketGrid<TRoundData, TMatchData>({ spanElementWidth: options.columnWidth });
  const rounds = Array.from(bracketData.rounds.values());
  const firstRound = bracketData.rounds.first();

  if (!firstRound) {
    throw new Error('No rounds found in bracket data');
  }

  for (const [roundIndex, round] of rounds.entries()) {
    const isLastRound = roundIndex === rounds.length - 1;
    const { masterColumn, ...mutableMasterColumn } = createBracketMasterColumn<TRoundData, TMatchData>({
      columnWidth: round.type === COMMON_BRACKET_ROUND_TYPE.FINAL ? options.finalColumnWidth : options.columnWidth,
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

  grid.calculateDimensions();

  return grid.grid;
};
