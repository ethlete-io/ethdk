import { ComponentType } from '@angular/cdk/portal';
import { InputSignal } from '@angular/core';
import {
  BracketData,
  BracketMatch,
  BracketRound,
  BracketRoundMapWithSwissData,
  BracketRoundRelations,
  BracketRoundTypeMap,
  TOURNAMENT_MODE,
} from './bracket-new';
import { NewBracketDefaultMatchComponent } from './new-bracket-default-match.component';
import { NewBracketDefaultRoundHeaderComponent } from './new-bracket-default-round-header.component';

export type BracketRoundHeaderComponent<TRoundData, TMatchData> = ComponentType<{
  bracketRound: InputSignal<BracketRound<TRoundData, TMatchData>>;
}>;

export type ComponentInputValue<T> = () => {
  [P in keyof T]: T[P] extends InputSignal<infer U> ? U : never;
};

export type BracketMatchComponent<TRoundData, TMatchData> = ComponentType<{
  bracketRound: InputSignal<BracketRound<TRoundData, TMatchData>>;
  bracketMatch: InputSignal<BracketMatch<TRoundData, TMatchData>>;
}>;

export type BracketGridRoundItem<TRoundData, TMatchData> = {
  id: string;
  columnStart: number;
  columnEnd: number;
  items: BracketGridItem<TRoundData, TMatchData>[];
};

export type BracketGridRoundHeaderItem<TRoundData, TMatchData> = {
  type: 'round';
  id: string;
  rowStart: number;
  rowEnd: number;
  component: BracketRoundHeaderComponent<TRoundData, TMatchData>;
  data: {
    bracketRound: BracketRound<TRoundData, TMatchData>;
  };
};

export type BracketGridMatchItem<TRoundData, TMatchData> = {
  type: 'match';
  id: string;
  rowStart: number;
  rowEnd: number;
  component: BracketMatchComponent<TRoundData, TMatchData>;
  data: {
    bracketRound: BracketRound<TRoundData, TMatchData>;
    bracketMatch: BracketMatch<TRoundData, TMatchData>;
  };
};

export type BracketGridItem<TRoundData, TMatchData> =
  | BracketGridRoundHeaderItem<TRoundData, TMatchData>
  | BracketGridMatchItem<TRoundData, TMatchData>;

export type GenerateBracketGridItemsOptions<TRoundData, TMatchData> = {
  includeRoundHeaders: boolean;
  headerComponent?: BracketRoundHeaderComponent<TRoundData, TMatchData>;
  matchComponent?: BracketMatchComponent<TRoundData, TMatchData>;
};

export type GenerateBracketGridItemsOptionsWithDefaults<TRoundData, TMatchData> = {
  includeRoundHeaders: boolean;
  headerComponent: BracketRoundHeaderComponent<TRoundData, TMatchData>;
  matchComponent: BracketMatchComponent<TRoundData, TMatchData>;
};

export const generateBracketGridItems = <TRoundData, TMatchData>(
  bracketData: BracketData<TRoundData, TMatchData>,
  roundTypeMap: BracketRoundTypeMap<TRoundData, TMatchData>,
  swissGroups: BracketRoundMapWithSwissData<TRoundData, TMatchData> | null,
  roundRelations: BracketRoundRelations<TRoundData, TMatchData>,
  options: GenerateBracketGridItemsOptions<TRoundData, TMatchData>,
) => {
  const roundHeaderComponent = options.headerComponent ?? NewBracketDefaultRoundHeaderComponent;
  const matchComponent = options.matchComponent ?? NewBracketDefaultMatchComponent;

  const optionsWithDefaults: GenerateBracketGridItemsOptionsWithDefaults<TRoundData, TMatchData> = {
    ...options,
    headerComponent: roundHeaderComponent,
    matchComponent: matchComponent,
  };

  switch (bracketData.mode) {
    case TOURNAMENT_MODE.DOUBLE_ELIMINATION:
      return generateDoubleEliminationGridPlacements(bracketData, roundTypeMap, roundRelations, optionsWithDefaults);
    case TOURNAMENT_MODE.SWISS_WITH_ELIMINATION: {
      if (!swissGroups) throw new Error('Swiss groups are required for swiss with elimination mode');

      return generateSwissWithEliminationGridPlacements(
        bracketData,
        roundTypeMap,
        swissGroups,
        roundRelations,
        optionsWithDefaults,
      );
    }

    default:
      return generateGenericGridPlacements(bracketData, roundTypeMap, roundRelations, optionsWithDefaults);
  }
};

const generateGenericGridPlacements = <TRoundData, TMatchData>(
  bracketData: BracketData<TRoundData, TMatchData>,
  roundTypeMap: BracketRoundTypeMap<TRoundData, TMatchData>,
  roundRelations: BracketRoundRelations<TRoundData, TMatchData>,
  options: GenerateBracketGridItemsOptionsWithDefaults<TRoundData, TMatchData>,
) => {
  const gridItems: BracketGridRoundItem<TRoundData, TMatchData>[] = [];
  const firstRound = bracketData.rounds.values().next().value;

  if (!firstRound) {
    throw new Error('First round is missing');
  }

  for (const round of bracketData.rounds.values()) {
    const relation = roundRelations.get(round.id);

    let currentMatchRow = 1;

    const columnStart = round.index + 1;
    const columnEnd = columnStart + 1;

    if (!relation) {
      throw new Error('Round relation is missing');
    }

    if (relation.type === 'two-to-nothing' || relation.type === 'two-to-one') {
      throw new Error(`Invalid relation type ${relation.type}`);
    }

    const roundItem: BracketGridRoundItem<TRoundData, TMatchData> = {
      id: round.id,
      columnStart,
      columnEnd,
      items: [],
    };

    if (options.includeRoundHeaders) {
      const roundHeaderItem: BracketGridRoundHeaderItem<TRoundData, TMatchData> = {
        type: 'round',
        id: round.id,
        rowStart: currentMatchRow,
        rowEnd: ++currentMatchRow,
        component: options.headerComponent,
        data: {
          bracketRound: round,
        },
      };

      roundItem.items.push(roundHeaderItem);
    }

    const rootRoundMatchFactor = relation.type !== 'nothing-to-one' ? relation.rootRoundMatchFactor : null;
    const matchHeight = rootRoundMatchFactor ? rootRoundMatchFactor : 1;

    for (const match of round.matches.values()) {
      const baseRow = match.indexInRound * matchHeight;

      const matchItem: BracketGridMatchItem<TRoundData, TMatchData> = {
        type: 'match',
        id: match.id,
        rowStart: baseRow + currentMatchRow,
        rowEnd: baseRow + currentMatchRow + matchHeight,
        component: options.matchComponent,
        data: {
          bracketRound: round,
          bracketMatch: match,
        },
      };

      roundItem.items.push(matchItem);
    }

    gridItems.push(roundItem);
  }

  return gridItems;
};

const generateDoubleEliminationGridPlacements = <TRoundData, TMatchData>(
  bracketData: BracketData<TRoundData, TMatchData>,
  roundTypeMap: BracketRoundTypeMap<TRoundData, TMatchData>,
  roundRelations: BracketRoundRelations<TRoundData, TMatchData>,
  options: GenerateBracketGridItemsOptionsWithDefaults<TRoundData, TMatchData>,
) => {
  const gridItems: BracketGridRoundItem<TRoundData, TMatchData>[] = [];

  return gridItems;
};

const generateSwissWithEliminationGridPlacements = <TRoundData, TMatchData>(
  bracketData: BracketData<TRoundData, TMatchData>,
  roundTypeMap: BracketRoundTypeMap<TRoundData, TMatchData>,
  swissGroups: BracketRoundMapWithSwissData<TRoundData, TMatchData>,
  roundRelations: BracketRoundRelations<TRoundData, TMatchData>,
  options: GenerateBracketGridItemsOptionsWithDefaults<TRoundData, TMatchData>,
) => {
  const gridItems: BracketGridRoundItem<TRoundData, TMatchData>[] = [];

  return gridItems;
};
