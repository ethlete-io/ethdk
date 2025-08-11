import { GenerateBracketGridDefinitionsOptions } from '../../grid-definitions';
import { NewBracket, NewBracketRound } from '../../linked';
import {
  BracketElementType,
  BracketMasterColumn,
  BracketMasterColumnSection,
  createBracketElement,
  createBracketElementPart,
  createBracketGapMasterColumnColumn,
  createBracketGrid,
  createBracketMasterColumn,
  createBracketMasterColumnSection,
  createBracketSubColumn,
  Span,
} from './core';

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
      masterColumn,
      type: 'round',
    });

    const sub = createRoundBracketSubColumn({
      masterColumn,
      masterColumnSection,
      firstRound,
      round,
      options,
      totalSubColumns: 1,
      span: {
        isStart: true,
        isEnd: true,
      },
      isFirstSubColumn: true,
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

export const createRoundBracketSubColumn = (config: {
  masterColumn: BracketMasterColumn;
  masterColumnSection: BracketMasterColumnSection;
  firstRound: NewBracketRound<any, any>;
  round: NewBracketRound<any, any>;
  totalSubColumns: number;
  span: Span;
  isFirstSubColumn: boolean;
  options: GenerateBracketGridDefinitionsOptions;
}) => {
  const { masterColumn, masterColumnSection, firstRound, round, options, span, isFirstSubColumn } = config;

  const { subColumn, pushElement } = createBracketSubColumn({
    span,
  });

  const matchFactor = firstRound.matchCount / round.matchCount;
  const matches = Array.from(round.matches.values());

  const elementsToCreate: Array<{
    type: BracketElementType;
    area: string;
    partHeights: number[];
    elementHeight: number;
  }> = [];

  // Only include a header row if headers exist
  if (options.roundHeaderHeight > 0) {
    elementsToCreate.push(
      {
        type: 'header',
        area: `h${round.shortId}`,
        partHeights: [options.roundHeaderHeight],
        elementHeight: options.roundHeaderHeight,
      },
      {
        type: 'roundHeaderGap',
        area: '.',
        partHeights: [options.rowGap],
        elementHeight: options.rowGap,
      },
    );
  }

  // Add match elements to create
  for (const [matchIndex, match] of matches.entries()) {
    const isLastMatch = matchIndex === matches.length - 1;

    const matchRows: number[] = [];
    for (let factorIndex = 0; factorIndex < matchFactor; factorIndex++) {
      const isLastFactor = factorIndex === matchFactor - 1;

      // Add the match height
      matchRows.push(options.matchHeight);

      if (isLastFactor) continue;

      // Add gap between match factors (except after the last one)
      matchRows.push(options.rowGap);
    }

    elementsToCreate.push({
      type: 'match',
      area: `m${match.shortId}`,
      partHeights: matchRows,
      elementHeight: options.matchHeight,
    });

    if (!isLastMatch) {
      elementsToCreate.push({
        type: 'matchGap',
        area: '.',
        partHeights: [options.rowGap],
        elementHeight: options.rowGap,
      });
    }
  }

  // Create all elements at once
  for (const elementData of elementsToCreate) {
    const { element, pushPart } = createBracketElement({
      area: elementData.area,
      subColumn,
      type: elementData.type,
      elementHeight: elementData.elementHeight,
    });

    for (const elementPartHeight of elementData.partHeights) {
      pushPart(
        createBracketElementPart({
          element,
          subColumn,
          elementPartHeight,
        }).elementPart,
      );
    }

    pushElement(element);
  }

  return subColumn;
};
