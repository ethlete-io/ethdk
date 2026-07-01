import { BracketRoundSwissData, generateBracketRoundSwissGroupMaps, NewBracket } from '../../linked';
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

type SwissColumnMetrics = {
  naturalHeight: number;
  stretchableGapCount: number;
};

const getSwissGroupBoxPadding = (options: CreateBracketGridConfig) =>
  options.swissGroupPadding + options.swissGroupBorderWidth;

const calculateSwissColumnMetrics = <TRoundData, TMatchData>(
  groupMap: BracketRoundSwissData<TRoundData, TMatchData>,
  options: CreateBracketGridConfig,
): SwissColumnMetrics => {
  const includeHeaders = options.roundHeaderHeight > 0;
  const boxPadding = getSwissGroupBoxPadding(options);

  let naturalHeight = 0;
  let stretchableGapCount = 0;

  for (const [groupIndex, group] of Array.from(groupMap.groups.values()).entries()) {
    if (groupIndex !== 0) {
      // The gap section between two groups
      naturalHeight += options.rowRoundGap;
      stretchableGapCount++;
    }

    // The round header gap is not stretchable: the first match should always sit directly
    // below it, no matter how much a column gets stretched.
    if (includeHeaders) {
      naturalHeight += options.roundHeaderHeight + options.roundHeaderGap;
    }

    const matchGapCount = Math.max(0, group.matches.size - 1);

    naturalHeight += boxPadding * 2 + group.matches.size * options.matchHeight + matchGapCount * options.rowGap;
    stretchableGapCount += matchGapCount;
  }

  return { naturalHeight, stretchableGapCount };
};

// The naturally tallest master column (the round with the most groups) keeps the original
// gaps (rowGap, rowRoundGap, roundHeaderGap) and defines the total bracket height.
// The master cols before it are stretched to that height by distributing the missing
// height evenly across all of their gap elements.
// The master cols after it keep the original gaps, resulting in a top alignment. They get
// one more gap element at the end of the column to fill the remaining space if any.
export const createSwissGrid = <TRoundData, TMatchData>(
  bracketData: NewBracket<TRoundData, TMatchData>,
  options: CreateBracketGridConfig,
  components: BracketComponents<TRoundData, TMatchData>,
): ComputedBracketGrid<TRoundData, TMatchData> => {
  const swissGroupMaps = generateBracketRoundSwissGroupMaps(bracketData);

  if (!swissGroupMaps) throw new Error('Unable to generate Swiss groups for the provided bracket data');

  const grid = createBracketGrid<TRoundData, TMatchData>({ spanElementWidth: options.columnWidth });

  const groupMaps = Array.from(swissGroupMaps.values());
  const columnMetrics = groupMaps.map((groupMap) => calculateSwissColumnMetrics(groupMap, options));

  const totalHeight = Math.max(...columnMetrics.map((metrics) => metrics.naturalHeight));
  const longestColumnIndex = columnMetrics.findIndex((metrics) => metrics.naturalHeight === totalHeight);

  for (const [groupMapIndex, groupMap] of groupMaps.entries()) {
    const isLastGroupMap = groupMapIndex === swissGroupMaps.size - 1;

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const metrics = columnMetrics[groupMapIndex]!;
    const heightToFill = totalHeight - metrics.naturalHeight;
    const isStretched = groupMapIndex < longestColumnIndex && metrics.stretchableGapCount > 0;
    const gapStretch = isStretched ? heightToFill / metrics.stretchableGapCount : 0;

    const rowGap = options.rowGap + gapStretch;
    const rowRoundGap = options.rowRoundGap + gapStretch;

    // The border and group padding are part of the column width (the match elements
    // shrink by them), so the column footprint stays at columnWidth and the group borders
    // drawn around the matches don't overflow the bracket container. The padding lives on
    // the match list sections, the header and gap sections stay unpadded and span the
    // whole column width.
    const boxPadding = getSwissGroupBoxPadding(options);

    const { masterColumn, pushSection } = createBracketMasterColumn<TRoundData, TMatchData>({
      columnWidth: options.columnWidth,
      padding: {
        bottom: 0,
        left: 0,
        right: 0,
        top: 0,
      },
    });

    for (const [groupIndex, group] of Array.from(groupMap.groups.values()).entries()) {
      const isLastGroup = groupIndex === groupMap.groups.size - 1;

      if (options.roundHeaderHeight > 0) {
        const firstMatchRound = group.matches.first()?.round;

        if (!firstMatchRound) throw new Error('No rounds found in Swiss group');

        const headerColumnSection = createBracketMasterColumnSection<TRoundData, TMatchData>({
          type: 'round',
        });

        const headerSubColumn = createBracketSubColumn<TRoundData, TMatchData>({
          span: {
            isStart: true,
            isEnd: true,
          },
        });

        const headerElement = createBracketElement<TRoundData, TMatchData>({
          type: 'header',
          area: `h${group.id}`,
          partHeights: [options.roundHeaderHeight],
          elementHeight: options.roundHeaderHeight,
          component: components.roundHeader,
          round: firstMatchRound,
          roundSwissGroup: group,
        });

        const headerGapElement = createBracketElement<TRoundData, TMatchData>({
          type: 'roundHeaderGap',
          area: '.',
          partHeights: [options.roundHeaderGap],
          elementHeight: options.roundHeaderGap,
        });

        headerSubColumn.pushElement(headerElement.element, headerGapElement.element);
        headerColumnSection.pushSubColumn(headerSubColumn.subColumn);
        pushSection(headerColumnSection.masterColumnSection);
      }

      const { masterColumnSection, pushSubColumn } = createBracketMasterColumnSection<TRoundData, TMatchData>({
        type: 'round',
        padding: {
          bottom: boxPadding,
          left: boxPadding,
          right: boxPadding,
          top: boxPadding,
        },
      });

      const { subColumn, pushElement } = createBracketSubColumn<TRoundData, TMatchData>({
        span: {
          isStart: true,
          isEnd: true,
        },
      });

      const elementsToCreate: Array<BracketElementToCreate<TRoundData, TMatchData>> = [];

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
            partHeights: [rowGap],
            elementHeight: rowGap,
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
          elementHeight: rowRoundGap,
          partHeights: [rowRoundGap],
        });

        groupGapSubColumn.pushElement(groupGapElement.element);

        groupGapColumnSection.pushSubColumn(groupGapSubColumn.subColumn);

        pushSection(groupGapColumnSection.masterColumnSection);
      }
    }

    // Top aligned columns end above the total height, so we fill the remaining space with
    // one last gap element.
    const fillerHeight = isStretched ? 0 : heightToFill;

    if (fillerHeight > 0) {
      const fillerColumnSection = createBracketMasterColumnSection<TRoundData, TMatchData>({
        type: 'gap',
      });

      const fillerSubColumn = createBracketSubColumn<TRoundData, TMatchData>({
        span: {
          isStart: true,
          isEnd: true,
        },
      });

      const fillerElement = createBracketElement<TRoundData, TMatchData>({
        area: '.',
        type: 'colGap',
        elementHeight: fillerHeight,
        partHeights: [fillerHeight],
      });

      fillerSubColumn.pushElement(fillerElement.element);
      fillerColumnSection.pushSubColumn(fillerSubColumn.subColumn);
      pushSection(fillerColumnSection.masterColumnSection);
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

  return {
    raw: grid,
    columns: finalizedGrid.columns,
    matchElementMap: finalizedGrid.elementMap,
  };
};
