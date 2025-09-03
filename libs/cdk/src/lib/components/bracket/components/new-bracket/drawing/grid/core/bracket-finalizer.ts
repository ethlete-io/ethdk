import { BracketMap } from '../../../core';
import { BracketRoundSwissGroup, NewBracketMatch, NewBracketRound } from '../../../linked';
import { MutableBracketGrid } from './bracket-grid';
import { BracketMatchComponent, BracketRoundHeaderComponent, Dimensions } from './types';

export type FinalizedBracketColumn<TRoundData = unknown, TMatchData = unknown> = {
  dimensions: Dimensions;
  elements: FinalizedBracketElement<TRoundData, TMatchData>[];
};

export type FinalizedHeaderBracketElement<TRoundData, TMatchData> = {
  type: 'header';
  dimensions: Dimensions;
  component: BracketRoundHeaderComponent<TRoundData, TMatchData>;
  round: NewBracketRound<TRoundData, TMatchData>;
  roundSwissGroup: BracketRoundSwissGroup<TRoundData, TMatchData> | null;
};

export type FinalizedMatchBracketElement<TRoundData, TMatchData> = {
  type: 'match';
  dimensions: Dimensions;
  component: BracketMatchComponent<TRoundData, TMatchData>;
  match: NewBracketMatch<TRoundData, TMatchData>;
  round: NewBracketRound<TRoundData, TMatchData>;
  roundSwissGroup: BracketRoundSwissGroup<TRoundData, TMatchData> | null;
  classes: string;
};

export type FinalizedBracketElement<TRoundData = unknown, TMatchData = unknown> =
  | FinalizedHeaderBracketElement<TRoundData, TMatchData>
  | FinalizedMatchBracketElement<TRoundData, TMatchData>;

export type FinalizedBracketMatchElementMap<TRoundData, TMatchData> = BracketMap<
  string,
  FinalizedMatchBracketElement<TRoundData, TMatchData>
>;

export const finalizeBracketGrid = <TRoundData, TMatchData>(grid: MutableBracketGrid<TRoundData, TMatchData>) => {
  const finalizedColumns: FinalizedBracketColumn<TRoundData, TMatchData>[] = [];
  const finalizedElementMap: FinalizedBracketMatchElementMap<TRoundData, TMatchData> = new BracketMap();

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
            roundSwissGroup: element.roundSwissGroup,
          });
        } else if (element.type === 'match') {
          const matchEl: FinalizedMatchBracketElement<TRoundData, TMatchData> = {
            type: 'match',
            dimensions: element.dimensions,
            component: element.component,
            match: element.match,
            round: element.round,
            classes: [element.match.home?.shortId, element.match.away?.shortId].filter((v) => !!v).join(' '),
            roundSwissGroup: element.roundSwissGroup,
          };

          elements.push(matchEl);
          finalizedElementMap.set(element.match.id, matchEl);
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

      finalizedColumns.push({
        dimensions: {
          ...section.dimensions,
          width: sectionWidth,
        },
        elements,
      });
    }
  }

  return {
    columns: finalizedColumns,
    elementMap: finalizedElementMap,
  };
};
