import { GenerateBracketGridDefinitionsOptions } from '../../grid-definitions';
import { NewBracket } from '../../linked';
import { createBracketGrid, createBracketMasterColumn, createBracketMasterColumnSection } from './core';
import { createBracketGapMasterColumnColumn, createRoundBracketSubColumnRelativeToFirstRound } from './prebuild';

export const createSingleEliminationGrid = <TRoundData, TMatchData>(
  bracketData: NewBracket<TRoundData, TMatchData>,
  options: GenerateBracketGridDefinitionsOptions,
) => {
  const grid = createBracketGrid();
  const rounds = Array.from(bracketData.rounds.values());
  const firstRound = bracketData.rounds.first();

  if (!firstRound) {
    throw new Error('No rounds found in bracket data');
  }

  for (const [roundIndex, round] of rounds.entries()) {
    const isLastRound = roundIndex === rounds.length - 1;
    const { masterColumn, ...mutableMasterColumn } = createBracketMasterColumn({
      columnWidth: options.columnWidth,
    });

    const { masterColumnSection, pushSubColumn } = createBracketMasterColumnSection({
      type: 'round',
    });

    const sub = createRoundBracketSubColumnRelativeToFirstRound({
      firstRound,
      round,
      options,
      span: {
        isStart: true,
        isEnd: true,
      },
    });
    pushSubColumn(sub);

    mutableMasterColumn.pushSection(masterColumnSection);

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
