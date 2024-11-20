import { ComponentType } from '@angular/cdk/portal';
import { InputSignal } from '@angular/core';
import {
  BracketData,
  BracketDataLayout,
  BracketMatch,
  BracketMatchId,
  BracketMatchRelation,
  BracketMatchRelationsMap,
  BracketRound,
  BracketRoundId,
  BracketRoundMapWithSwissData,
  BracketRoundRelation,
  BracketRoundRelations,
  BracketRoundTypeMap,
  canRenderLayoutInTournamentMode,
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
  layoutId: string;
  columnStart: number;
  columnEnd: number;
  roundRelation: BracketRoundRelation<TRoundData, TMatchData>;
  items: Map<BracketRoundId | BracketMatchId, BracketGridItem<TRoundData, TMatchData>>;
};

export type BracketGridRoundHeaderItem<TRoundData, TMatchData> = {
  type: 'round';
  id: string;
  layoutId: string;
  rowStart: number;
  rowEnd: number;
  component: BracketRoundHeaderComponent<TRoundData, TMatchData>;
  roundRelation: BracketRoundRelation<TRoundData, TMatchData>;
  data: {
    bracketRound: BracketRound<TRoundData, TMatchData>;
  };
};

export type BracketGridMatchItem<TRoundData, TMatchData> = {
  type: 'match';
  id: string;
  layoutId: string;
  rowStart: number;
  rowEnd: number;
  component: BracketMatchComponent<TRoundData, TMatchData>;
  matchRelation: BracketMatchRelation<TRoundData, TMatchData>;
  roundRelation: BracketRoundRelation<TRoundData, TMatchData>;
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
  layout: BracketDataLayout;
  headerComponent?: BracketRoundHeaderComponent<TRoundData, TMatchData>;
  matchComponent?: BracketMatchComponent<TRoundData, TMatchData>;
};

export type GenerateBracketGridItemsOptionsWithDefaults<TRoundData, TMatchData> = {
  includeRoundHeaders: boolean;
  layout: BracketDataLayout;
  headerComponent: BracketRoundHeaderComponent<TRoundData, TMatchData>;
  matchComponent: BracketMatchComponent<TRoundData, TMatchData>;
};

export const generateBracketGridItems = <TRoundData, TMatchData>(
  bracketData: BracketData<TRoundData, TMatchData>,
  roundTypeMap: BracketRoundTypeMap<TRoundData, TMatchData>,
  swissGroups: BracketRoundMapWithSwissData<TRoundData, TMatchData> | null,
  roundRelations: BracketRoundRelations<TRoundData, TMatchData>,
  matchRelations: BracketMatchRelationsMap<TRoundData, TMatchData>,
  options: GenerateBracketGridItemsOptions<TRoundData, TMatchData>,
) => {
  const roundHeaderComponent = options.headerComponent ?? NewBracketDefaultRoundHeaderComponent;
  const matchComponent = options.matchComponent ?? NewBracketDefaultMatchComponent;

  const optionsWithDefaults: GenerateBracketGridItemsOptionsWithDefaults<TRoundData, TMatchData> = {
    ...options,
    headerComponent: roundHeaderComponent,
    matchComponent: matchComponent,
  };

  if (!canRenderLayoutInTournamentMode(options.layout, bracketData.mode)) {
    throw new Error(`Invalid layout ${options.layout} for tournament mode ${bracketData.mode}`);
  }

  switch (bracketData.mode) {
    case TOURNAMENT_MODE.DOUBLE_ELIMINATION:
      return generateDoubleEliminationGridPlacements(
        bracketData,
        roundTypeMap,
        roundRelations,
        matchRelations,
        optionsWithDefaults,
      );
    case TOURNAMENT_MODE.SWISS_WITH_ELIMINATION: {
      if (!swissGroups) throw new Error('Swiss groups are required for swiss with elimination mode');

      return generateSwissWithEliminationGridPlacements(
        bracketData,
        roundTypeMap,
        swissGroups,
        roundRelations,
        matchRelations,
        optionsWithDefaults,
      );
    }

    default:
      return generateGenericGridPlacements(
        bracketData,
        roundTypeMap,
        roundRelations,
        matchRelations,
        optionsWithDefaults,
      );
  }
};

const generateGenericGridPlacements = <TRoundData, TMatchData>(
  bracketData: BracketData<TRoundData, TMatchData>,
  roundTypeMap: BracketRoundTypeMap<TRoundData, TMatchData>,
  roundRelations: BracketRoundRelations<TRoundData, TMatchData>,
  matchRelations: BracketMatchRelationsMap<TRoundData, TMatchData>,
  options: GenerateBracketGridItemsOptionsWithDefaults<TRoundData, TMatchData>,
) => {
  const gridItems: Map<BracketRoundId, BracketGridRoundItem<TRoundData, TMatchData>> = new Map();
  const firstRound = bracketData.rounds.values().next().value;

  if (!firstRound) {
    throw new Error('First round is missing');
  }

  for (const round of bracketData.rounds.values()) {
    const roundRelation = roundRelations.get(round.id);

    let currentMatchRow = 1;

    const columnStart = round.index + 1;
    const columnEnd = columnStart + 1;

    if (!roundRelation) {
      throw new Error('Round relation is missing');
    }

    if (roundRelation.type === 'two-to-nothing' || roundRelation.type === 'two-to-one') {
      throw new Error(`Invalid relation type ${roundRelation.type}`);
    }

    const roundItem: BracketGridRoundItem<TRoundData, TMatchData> = {
      id: round.id,
      layoutId: `${round.id}-layout`,
      columnStart,
      columnEnd,
      roundRelation,
      items: new Map(),
    };

    if (options.includeRoundHeaders) {
      const roundHeaderItem: BracketGridRoundHeaderItem<TRoundData, TMatchData> = {
        type: 'round',
        id: round.id,
        layoutId: `${round.id}-layout`,
        rowStart: currentMatchRow,
        rowEnd: ++currentMatchRow,
        component: options.headerComponent,
        roundRelation,
        data: {
          bracketRound: round,
        },
      };

      roundItem.items.set(round.id, roundHeaderItem);
    }

    const rootRoundMatchFactor = roundRelation.type !== 'nothing-to-one' ? roundRelation.rootRoundMatchFactor : null;
    const matchHeight = rootRoundMatchFactor ? rootRoundMatchFactor : 1;

    for (const match of round.matches.values()) {
      const matchRelation = matchRelations.get(match.id);

      if (!matchRelation) {
        throw new Error('Match relation is missing');
      }

      const baseRow = match.indexInRound * matchHeight;

      const matchItem: BracketGridMatchItem<TRoundData, TMatchData> = {
        type: 'match',
        id: match.id,
        layoutId: `${match.id}-layout`,
        rowStart: baseRow + currentMatchRow,
        rowEnd: baseRow + currentMatchRow + matchHeight,
        component: options.matchComponent,
        matchRelation,
        roundRelation,
        data: {
          bracketRound: round,
          bracketMatch: match,
        },
      };

      roundItem.items.set(match.id, matchItem);
    }

    gridItems.set(round.id, roundItem);
  }

  return gridItems;
};

const generateDoubleEliminationGridPlacements = <TRoundData, TMatchData>(
  bracketData: BracketData<TRoundData, TMatchData>,
  roundTypeMap: BracketRoundTypeMap<TRoundData, TMatchData>,
  roundRelations: BracketRoundRelations<TRoundData, TMatchData>,
  matchRelations: BracketMatchRelationsMap<TRoundData, TMatchData>,
  options: GenerateBracketGridItemsOptionsWithDefaults<TRoundData, TMatchData>,
) => {
  const gridItems: Map<BracketRoundId, BracketGridRoundItem<TRoundData, TMatchData>> = new Map();

  return gridItems;
};

const generateSwissWithEliminationGridPlacements = <TRoundData, TMatchData>(
  bracketData: BracketData<TRoundData, TMatchData>,
  roundTypeMap: BracketRoundTypeMap<TRoundData, TMatchData>,
  swissGroups: BracketRoundMapWithSwissData<TRoundData, TMatchData>,
  roundRelations: BracketRoundRelations<TRoundData, TMatchData>,
  matchRelations: BracketMatchRelationsMap<TRoundData, TMatchData>,
  options: GenerateBracketGridItemsOptionsWithDefaults<TRoundData, TMatchData>,
) => {
  const gridItems: Map<BracketRoundId, BracketGridRoundItem<TRoundData, TMatchData>> = new Map();

  return gridItems;
};
