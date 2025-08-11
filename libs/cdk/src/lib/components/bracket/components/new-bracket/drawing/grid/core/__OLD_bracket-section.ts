import { GenerateBracketGridDefinitionsOptions } from '../../../grid-definitions';
import { NewBracketRound } from '../../../linked';
import { BracketMasterColumn, BracketMasterColumnSection } from './types';

export const createBracketSection = <TRoundData, TMatchData>(
  existingMasterColumnSections: BracketMasterColumnSection[],
  masterColumn: BracketMasterColumn,
  round: {
    data: NewBracketRound<TRoundData, TMatchData>;

    // some rounds can span multiple columns (e.g. the last winner bracket round in double elimination)
    isSpanStart: boolean;
    isSpanEnd: boolean;
  },
  firstRound: NewBracketRound<TRoundData, TMatchData>,
  options: GenerateBracketGridDefinitionsOptions,
) => {
  // Calculate dimensions once
  const totalSectionsHeight = existingMasterColumnSections.reduce((sum, s) => sum + s.dimensions.height, 0);
  const totalSectionsGap = existingMasterColumnSections.length * options.upperLowerGap;
  const sectionTop = totalSectionsHeight + totalSectionsGap;

  const section: BracketMasterColumnSection = {
    subColumns: [],
    type: 'round',
    dimensions: {
      width: masterColumn.dimensions.width,
      height: 0,
      top: sectionTop,
      left: masterColumn.dimensions.left,
    },
  };

  // const elementsToCreate: Array<{
  //   type: BracketElementType;
  //   area: string;
  //   rows: number[];
  // }> = [];

  // // Only include a header row if headers exist
  // if (options.roundHeaderHeight > 0) {
  //   elementsToCreate.push(
  //     {
  //       type: 'header',
  //       area: `h${round.data.shortId}`,
  //       rows: [options.roundHeaderHeight],
  //     },
  //     {
  //       type: 'roundHeaderGap',
  //       area: '.',
  //       rows: [options.rowGap],
  //     },
  //   );
  // }

  // // Add match spans
  // const matchFactor = firstRound.matchCount / round.data.matchCount;
  // const matches = Array.from(round.data.matches.values());

  // for (const [matchIndex, match] of matches.entries()) {
  //   const isLastMatch = matchIndex === matches.length - 1;

  //   const matchRows: number[] = [];
  //   for (let factorIndex = 0; factorIndex < matchFactor; factorIndex++) {
  //     const isLastFactor = factorIndex === matchFactor - 1;

  //     // Add the match height
  //     matchRows.push(options.matchHeight);

  //     if (isLastFactor) continue;

  //     // Add gap between match factors (except after the last one)
  //     matchRows.push(options.rowGap);
  //   }

  //   elementsToCreate.push({
  //     type: 'match',
  //     area: `m${match.shortId}`,
  //     rows: matchRows,
  //   });

  //   if (!isLastMatch) {
  //     elementsToCreate.push({
  //       type: 'matchGap',
  //       area: '.',
  //       rows: [options.rowGap],
  //     });
  //   }
  // }

  // // Create all rowspans at once
  // let currentTop = section.dimensions.top;
  // for (const elementData of elementsToCreate) {
  //   const elementHeight = elementData.rows.reduce((sum, row) => sum + row, 0);

  //   section.elements.push({
  //     type: elementData.type,
  //     area: elementData.area,
  //     dimensions: {
  //       width: masterColumn.dimensions.width,
  //       height: elementHeight,
  //       top: currentTop,
  //       left: masterColumn.dimensions.left,
  //     },
  //     rows: elementData.rows.map((rowHeight) => {
  //       const row: BracketRow = {
  //         dimensions: {
  //           width: masterColumn.dimensions.width,
  //           height: rowHeight,
  //           top: currentTop,
  //           left: masterColumn.dimensions.left,
  //         },
  //       };
  //       currentTop += rowHeight;
  //       return row;
  //     }),
  //   });

  //   section.dimensions.height += elementHeight;
  // }

  return section;
};
