import { generateBracketRoundSwissGroupMaps, NewBracket } from '../../linked';
import {
  BracketComponents,
  BracketElementToCreate,
  createBracketElement,
  createBracketGrid,
  createBracketMasterColumn,
  createBracketMasterColumnSection,
  createBracketSubColumn,
  finalizeBracketGrid,
} from './core';
import { createBracketGapMasterColumn } from './prebuild';
import { ComputedBracketGrid, CreateBracketGridConfig } from './types';

// TODO
// The longest master col gets the original gaps (roundRowGap, rowGap)
// For the master cols before it, the gaps are computed so that the total height is the same as the longest master col
// For the master cols after it, original gaps are used again resulting in a top alignment.
// We push one more gap element at the end of the column to fill the remaining space if any
//
// Since we want to draw a line around each group of matches, we need to adjust the column width to account for the border width and the gap between the border and the match elements
// This can be done using the swissGroupPadding option
export const createSwissGrid = <TRoundData, TMatchData>(
  bracketData: NewBracket<TRoundData, TMatchData>,
  options: CreateBracketGridConfig,
  components: BracketComponents<TRoundData, TMatchData>,
): ComputedBracketGrid<TRoundData, TMatchData> => {
  const swissGroupMaps = generateBracketRoundSwissGroupMaps(bracketData);

  if (!swissGroupMaps) throw new Error('Unable to generate Swiss groups for the provided bracket data');

  const grid = createBracketGrid<TRoundData, TMatchData>({ spanElementWidth: options.columnWidth });

  for (const [groupMapIndex, groupMap] of Array.from(swissGroupMaps.values()).entries()) {
    const isLastGroupMap = groupMapIndex === swissGroupMaps.size - 1;

    const { masterColumn, pushSection } = createBracketMasterColumn<TRoundData, TMatchData>({
      columnWidth: options.columnWidth,
      padding: {
        bottom: options.swissGroupPadding,
        left: options.swissGroupPadding,
        right: options.swissGroupPadding,
        top: options.swissGroupPadding,
      },
    });

    for (const [groupIndex, group] of Array.from(groupMap.groups.values()).entries()) {
      const isLastGroup = groupIndex === groupMap.groups.size - 1;

      const { masterColumnSection, pushSubColumn } = createBracketMasterColumnSection<TRoundData, TMatchData>({
        type: 'round',
      });

      const { subColumn, pushElement } = createBracketSubColumn<TRoundData, TMatchData>({
        span: {
          isStart: true,
          isEnd: true,
        },
      });

      const elementsToCreate: Array<BracketElementToCreate<TRoundData, TMatchData>> = [];

      if (options.roundHeaderHeight > 0) {
        const firstMatchRound = group.matches.first()?.round;

        if (!firstMatchRound) throw new Error('No rounds found in Swiss group');

        elementsToCreate.push(
          {
            type: 'header',
            area: `h${group.id}`,
            partHeights: [options.roundHeaderHeight],
            elementHeight: options.roundHeaderHeight,
            component: components.roundHeader,
            round: firstMatchRound,
            roundSwissGroup: group,
          },
          {
            type: 'roundHeaderGap',
            area: '.',
            partHeights: [options.roundHeaderGap],
            elementHeight: options.roundHeaderGap,
          },
        );
      }

      for (const [matchIndex, match] of Array.from(group.matches.values()).entries()) {
        const isLastMatch = matchIndex === group.matches.size - 1;

        elementsToCreate.push({
          type: 'match',
          area: `m${match.shortId}`,
          partHeights: [options.matchHeight],
          elementHeight: options.matchHeight,
          component: components.match,
          match,
          round: match.round,
          roundSwissGroup: group,
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

      for (const elementData of elementsToCreate) {
        const { element } = createBracketElement(elementData);

        pushElement(element);
      }

      pushSubColumn(subColumn);
      pushSection(masterColumnSection);

      if (!isLastGroup) {
        const groupGapColumnSection = createBracketMasterColumnSection<TRoundData, TMatchData>({
          type: 'gap',
        });

        const groupGapSubColumn = createBracketSubColumn<TRoundData, TMatchData>({
          span: {
            isStart: true,
            isEnd: true,
          },
        });

        const groupGapElement = createBracketElement<TRoundData, TMatchData>({
          area: '.',
          type: 'roundGap',
          elementHeight: options.rowRoundGap,
          partHeights: [options.rowRoundGap],
        });

        groupGapSubColumn.pushElement(groupGapElement.element);

        groupGapColumnSection.pushSubColumn(groupGapSubColumn.subColumn);

        pushSection(groupGapColumnSection.masterColumnSection);
      }
    }

    grid.pushMasterColumn(masterColumn);

    if (!isLastGroupMap) {
      grid.pushMasterColumn(
        createBracketGapMasterColumn({
          existingMasterColumns: grid.grid.masterColumns,
          columnGap: options.columnGap,
        }),
      );
    }
  }

  grid.calculateDimensions();

  const finalizedGrid = finalizeBracketGrid(grid);

  console.log(grid);

  return {
    raw: grid,
    columns: finalizedGrid.columns,
    matchElementMap: finalizedGrid.elementMap,
  };
};
