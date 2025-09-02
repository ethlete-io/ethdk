import { BracketMatchComponent, BracketRoundHeaderComponent } from '../../../grid-placements';
import { NewBracketMatch, NewBracketRound } from '../../../linked';
import { MutableBracketGrid } from './bracket-grid';
import { Dimensions } from './types';

export type FinalizedBracketColumn<TRoundData = unknown, TMatchData = unknown> = {
  dimensions: Dimensions;
  elements: FinalizedBracketElement<TRoundData, TMatchData>[];
};

export type FinalizedHeaderBracketElement<TRoundData, TMatchData> = {
  type: 'header';
  dimensions: Dimensions;
  component: BracketRoundHeaderComponent<TRoundData, TMatchData>;
  round: NewBracketRound<TRoundData, TMatchData>;
};

export type FinalizedMatchBracketElement<TRoundData, TMatchData> = {
  type: 'match';
  dimensions: Dimensions;
  component: BracketMatchComponent<TRoundData, TMatchData>;
  match: NewBracketMatch<TRoundData, TMatchData>;
  round: NewBracketRound<TRoundData, TMatchData>;
};

export type FinalizedBracketElement<TRoundData = unknown, TMatchData = unknown> =
  | FinalizedHeaderBracketElement<TRoundData, TMatchData>
  | FinalizedMatchBracketElement<TRoundData, TMatchData>;

export const finalizeBracketGrid = <TRoundData, TMatchData>(grid: MutableBracketGrid<TRoundData, TMatchData>) => {
  const finalizedColumnsMap: FinalizedBracketColumn<TRoundData, TMatchData>[] = [];

  const ignoredSections: { masterColumnIndex: number; sectionIndex: number }[] = [];

  for (const [masterColumnIndex, masterColumn] of grid.grid.masterColumns.entries()) {
    for (const [sectionIndex, section] of masterColumn.sections.entries()) {
      if (ignoredSections.some((s) => s.masterColumnIndex === masterColumnIndex && s.sectionIndex === sectionIndex)) {
        continue;
      }

      const elements: FinalizedBracketElement<TRoundData, TMatchData>[] = [];
      const firstSubColumn = section.subColumns[0];
      const lastSubColumn = section.subColumns[section.subColumns.length - 1];

      if (!firstSubColumn || !lastSubColumn) continue;

      let sectionWidth = section.dimensions.width;

      for (const element of firstSubColumn.elements) {
        if (element.type === 'header') {
          elements.push({
            type: 'header',
            dimensions: element.dimensions,
            component: element.component,
            round: element.round,
          });
        } else if (element.type === 'match') {
          elements.push({
            type: 'match',
            dimensions: element.dimensions,
            component: element.component,
            match: element.match,
            round: element.round,
          });
        }
      }

      if (!lastSubColumn.span.isEnd) {
        for (let index = masterColumnIndex + 1; index < grid.grid.masterColumns.length; index++) {
          const nextMaster = grid.grid.masterColumns[index];
          const nextSection = nextMaster?.sections[sectionIndex];

          if (!nextSection) break;

          sectionWidth += nextSection.dimensions.width;
          ignoredSections.push({ masterColumnIndex: index, sectionIndex });

          if (nextSection.subColumns.some((sc) => sc.span.isEnd)) {
            break;
          }
        }
      }

      if (!elements.length) continue;

      finalizedColumnsMap.push({
        dimensions: {
          ...section.dimensions,
          width: sectionWidth,
        },
        elements,
      });
    }
  }

  return finalizedColumnsMap;
};
