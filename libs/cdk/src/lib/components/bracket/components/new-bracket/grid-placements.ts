import { ComponentType } from '@angular/cdk/portal';
import { InputSignal } from '@angular/core';
import {
  BracketMatchId,
  BracketRoundId,
  COMMON_BRACKET_ROUND_TYPE,
  DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE,
  TOURNAMENT_MODE,
} from './core';
import {
  BracketMatchRelation,
  BracketRoundMapWithSwissData,
  BracketRoundRelation,
  NewBracket,
  NewBracketMatch,
  NewBracketRound,
} from './linked';
import { NewBracketDefaultMatchComponent } from './new-bracket-default-match.component';
import { NewBracketDefaultRoundHeaderComponent } from './new-bracket-default-round-header.component';

export type BracketRoundHeaderComponent<TRoundData, TMatchData> = ComponentType<{
  bracketRound: InputSignal<NewBracketRound<TRoundData, TMatchData>>;
}>;

export type ComponentInputValue<T> = () => {
  [P in keyof T]: T[P] extends InputSignal<infer U> ? U : never;
};

export type BracketMatchComponent<TRoundData, TMatchData> = ComponentType<{
  bracketRound: InputSignal<NewBracketRound<TRoundData, TMatchData>>;
  bracketMatch: InputSignal<NewBracketMatch<TRoundData, TMatchData>>;
}>;

export type BracketGridRoundItem<TRoundData, TMatchData> = {
  id: BracketRoundId;
  layoutId: `${BracketRoundId}-layout`;
  columnStart: number;
  columnEnd: number;
  columnDefinitions: string;
  rowStart: number;
  rowEnd: number;
  rowDefinitions: string;
  roundRelation: BracketRoundRelation<TRoundData, TMatchData>;
  items: Map<BracketRoundId | BracketMatchId, BracketGridItem<TRoundData, TMatchData>>;
};

export type BracketGridRoundHeaderItem<TRoundData, TMatchData> = {
  type: 'round';
  id: BracketRoundId;
  layoutId: `${BracketRoundId}-layout`;
  rowStart: number;
  rowEnd: number;
  className: string;
  component: BracketRoundHeaderComponent<TRoundData, TMatchData>;
  roundRelation: BracketRoundRelation<TRoundData, TMatchData>;
  data: {
    bracketRound: NewBracketRound<TRoundData, TMatchData>;
  };
};

export type BracketGridMatchItem<TRoundData, TMatchData> = {
  type: 'match';
  id: BracketMatchId;
  layoutId: `${BracketMatchId}-layout`;
  rowStart: number;
  rowEnd: number;
  className: string;
  component: BracketMatchComponent<TRoundData, TMatchData>;
  matchRelation: BracketMatchRelation<TRoundData, TMatchData>;
  roundRelation: BracketRoundRelation<TRoundData, TMatchData>;
  data: {
    bracketRound: NewBracketRound<TRoundData, TMatchData>;
    bracketMatch: NewBracketMatch<TRoundData, TMatchData>;
  };
};

export type BracketGridItem<TRoundData, TMatchData> =
  | BracketGridRoundHeaderItem<TRoundData, TMatchData>
  | BracketGridMatchItem<TRoundData, TMatchData>;

export type GenerateBracketGridItemsOptions<TRoundData, TMatchData> = {
  includeRoundHeaders: boolean;
  headerComponent?: BracketRoundHeaderComponent<TRoundData, TMatchData>;
  matchComponent?: BracketMatchComponent<TRoundData, TMatchData>;
  finalMatchComponent?: BracketMatchComponent<TRoundData, TMatchData>;
};

export type GenerateBracketGridItemsOptionsWithDefaults<TRoundData, TMatchData> = {
  includeRoundHeaders: boolean;
  headerComponent: BracketRoundHeaderComponent<TRoundData, TMatchData>;
  matchComponent: BracketMatchComponent<TRoundData, TMatchData>;
  finalMatchComponent: BracketMatchComponent<TRoundData, TMatchData>;
};

export type GridPlacementGeneratorConfig<TRoundData, TMatchData> = {
  bracketData: NewBracket<TRoundData, TMatchData>;
  swissGroups: BracketRoundMapWithSwissData<TRoundData, TMatchData> | null;
  options: GenerateBracketGridItemsOptionsWithDefaults<TRoundData, TMatchData>;
};

export type GenerateBracketGridItemsData<TRoundData, TMatchData> = {
  bracketData: NewBracket<TRoundData, TMatchData>;
  swissGroups: BracketRoundMapWithSwissData<TRoundData, TMatchData> | null;
  options: GenerateBracketGridItemsOptions<TRoundData, TMatchData>;
};

export const generateBracketGridItems = <TRoundData, TMatchData>(
  data: GenerateBracketGridItemsData<TRoundData, TMatchData>,
) => {
  const { bracketData, swissGroups, options } = data;

  const roundHeaderComponent = options.headerComponent ?? NewBracketDefaultRoundHeaderComponent;
  const matchComponent = options.matchComponent ?? NewBracketDefaultMatchComponent;
  const finalMatchComponent = options.finalMatchComponent ?? matchComponent;

  const optionsWithDefaults: GenerateBracketGridItemsOptionsWithDefaults<TRoundData, TMatchData> = {
    ...options,
    headerComponent: roundHeaderComponent,
    matchComponent: matchComponent,
    finalMatchComponent: finalMatchComponent,
  };

  const config: GridPlacementGeneratorConfig<TRoundData, TMatchData> = {
    bracketData,
    swissGroups,
    options: optionsWithDefaults,
  };

  switch (bracketData.mode) {
    case TOURNAMENT_MODE.DOUBLE_ELIMINATION:
      return generateDoubleEliminationGridPlacements(config);
    case TOURNAMENT_MODE.SWISS_WITH_ELIMINATION: {
      return generateSwissWithEliminationGridPlacements(config);
    }
    default:
      return generateGenericGridPlacements(config);
  }
};

const generateGenericGridPlacements = <TRoundData, TMatchData>(
  config: GridPlacementGeneratorConfig<TRoundData, TMatchData>,
) => {
  const gridItems: Map<BracketRoundId, BracketGridRoundItem<TRoundData, TMatchData>> = new Map();
  const { bracketData, options } = config;

  const firstRound = bracketData.rounds.first();

  if (!firstRound) {
    throw new Error('First round is missing');
  }

  for (const round of bracketData.rounds.values()) {
    let currentMatchRow = 1;

    const columnStart = round.logicalIndex + 1;
    const columnEnd = columnStart + 1;
    const roundRelation = round.relation;

    if (roundRelation.type === 'two-to-nothing' || roundRelation.type === 'two-to-one') {
      throw new Error(`Invalid relation type ${roundRelation.type}`);
    }

    const roundItem: BracketGridRoundItem<TRoundData, TMatchData> = {
      id: round.id,
      layoutId: `${round.id}-layout`,
      columnStart,
      columnEnd,
      rowStart: 1,
      rowEnd: firstRound.matchCount + 1 + (options.includeRoundHeaders ? 1 : 0),
      roundRelation,
      items: new Map(),
      columnDefinitions: 'var(--_cw)',
      rowDefinitions: options.includeRoundHeaders
        ? `var(--_rhh) ${new Array(firstRound.matchCount).fill('var(--_mh)').join(' ')}`
        : `repeat(${firstRound.matchCount}, var(--_mh))`,
    };

    if (options.includeRoundHeaders) {
      const roundHeaderItem: BracketGridRoundHeaderItem<TRoundData, TMatchData> = {
        type: 'round',
        id: round.id,
        layoutId: `${round.id}-layout`,
        rowStart: currentMatchRow,
        rowEnd: ++currentMatchRow,
        component: options.headerComponent,
        className: 'et-bracket-new-item et-bracket-round-header-container',
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
      const matchRelation = match.relation;

      const baseRow = match.indexInRound * matchHeight;

      const participantShortIds = [match.home?.shortId, match.away?.shortId].filter((id) => !!id).join(' ');

      const matchItem: BracketGridMatchItem<TRoundData, TMatchData> = {
        type: 'match',
        id: match.id,
        layoutId: `${match.id}-layout`,
        rowStart: baseRow + currentMatchRow,
        rowEnd: baseRow + currentMatchRow + matchHeight,
        component:
          round.type === COMMON_BRACKET_ROUND_TYPE.FINAL ? options.finalMatchComponent : options.matchComponent,
        matchRelation,
        roundRelation,
        className: `et-bracket-new-item et-bracket-match-container ${participantShortIds}`,
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
  config: GridPlacementGeneratorConfig<TRoundData, TMatchData>,
) => {
  const gridItems: Map<BracketRoundId, BracketGridRoundItem<TRoundData, TMatchData>> = new Map();
  const { bracketData, options } = config;

  const upperBracketRounds = bracketData.roundsByType.getOrThrow(DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.UPPER_BRACKET);
  const lowerBracketRounds = bracketData.roundsByType.getOrThrow(DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.LOWER_BRACKET);

  const hasReverseFinal = !!bracketData.roundsByType.get(DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.REVERSE_FINAL);

  const firstUpperRound = upperBracketRounds.first();
  const firstLowerRound = lowerBracketRounds.first();

  const headerRowMod = options.includeRoundHeaders ? 1 : 0;

  if (!firstUpperRound) {
    throw new Error('First round is missing');
  }

  if (!firstLowerRound) {
    throw new Error('First lower round is missing');
  }

  const roundDelta = lowerBracketRounds.size - upperBracketRounds.size;
  const isAsyncBracket = roundDelta === 2;

  let currentUpperColumn = 1;

  for (const round of bracketData.rounds.values()) {
    let currentMatchRow = 1;

    const columnStart = round.logicalIndex + 1;
    const columnEnd = columnStart + 1;
    const roundRelation = round.relation;

    const isUpperBracket = round.type === DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.UPPER_BRACKET;
    const isUpperNeitherStartNorEnd = !round.isFirstOfType && !round.isLastOfType && isUpperBracket;
    const upperRowSpan = isUpperNeitherStartNorEnd || (isAsyncBracket && round.isLastOfType) ? 2 : 1;
    const isLowerBracket = round.type === DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.LOWER_BRACKET;

    const upperBracketRowStart = 1;
    const upperBracketRowEnd = firstUpperRound.matchCount + headerRowMod + 1;

    const lowerBracketRowStart = upperBracketRowEnd;
    const lowerBracketRowEnd = lowerBracketRowStart + headerRowMod + firstLowerRound.matchCount;

    const fullBracketRowStart = 1;
    const fullBracketRowEnd = lowerBracketRowEnd;

    const roundRowStart = isUpperBracket
      ? upperBracketRowStart
      : isLowerBracket
        ? lowerBracketRowStart
        : fullBracketRowStart;
    const roundRowEnd = isUpperBracket ? upperBracketRowEnd : isLowerBracket ? lowerBracketRowEnd : fullBracketRowEnd;

    const upperBracketColumnStart = currentUpperColumn;
    const upperBracketColumnEnd = currentUpperColumn + upperRowSpan;

    currentUpperColumn += upperRowSpan;

    const lowerBracketColumnStart = columnStart;
    const lowerBracketColumnEnd = columnEnd;

    const fullBracketColumnStart = columnStart;
    const fullBracketColumnEnd = columnEnd;

    const roundColumnStart = isUpperBracket
      ? upperBracketColumnStart
      : isLowerBracket
        ? lowerBracketColumnStart
        : fullBracketColumnStart;

    const roundColumnEnd = isUpperBracket
      ? upperBracketColumnEnd
      : isLowerBracket
        ? lowerBracketColumnEnd
        : fullBracketColumnEnd;

    const roundItem: BracketGridRoundItem<TRoundData, TMatchData> = {
      id: round.id,
      layoutId: `${round.id}-layout`,
      columnStart: roundColumnStart,
      columnEnd: roundColumnEnd,
      rowStart: roundRowStart,
      rowEnd: roundRowEnd,
      roundRelation,
      columnDefinitions: new Array(roundColumnEnd - roundColumnStart - 1).fill('var(--_cw)').join(' '),
      rowDefinitions: options.includeRoundHeaders
        ? `var(--_rhh) ${new Array(roundRowEnd - roundRowStart - 1).fill('var(--_mh)').join(' ')}`
        : `repeat(${roundRowEnd - roundRowStart - 1}, var(--_mh))`,
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
        className: 'et-bracket-new-item et-bracket-round-header-container',
        roundRelation,
        data: {
          bracketRound: round,
        },
      };

      roundItem.items.set(round.id, roundHeaderItem);
    }

    const rootRoundMatchFactor =
      roundRelation.type !== 'nothing-to-one' &&
      roundRelation.type !== 'two-to-nothing' &&
      roundRelation.type !== 'two-to-one'
        ? roundRelation.rootRoundMatchFactor
        : roundRelation.type === 'two-to-nothing' || roundRelation.type === 'two-to-one'
          ? roundRelation.upperRootRoundMatchFactor
          : null;

    const isPastUpperLower = !isUpperBracket && !isLowerBracket;

    const matchHeight = rootRoundMatchFactor ? rootRoundMatchFactor : 1;

    for (const match of round.matches.values()) {
      const matchRelation = match.relation;

      const baseRow = match.indexInRound * matchHeight;

      const participantShortIds = [match.home?.shortId, match.away?.shortId].filter((id) => !!id).join(' ');

      const matchItem: BracketGridMatchItem<TRoundData, TMatchData> = {
        type: 'match',
        id: match.id,
        layoutId: `${match.id}-layout`,
        rowStart: isPastUpperLower ? currentMatchRow : baseRow + currentMatchRow,
        rowEnd: isPastUpperLower ? roundRowEnd : baseRow + +currentMatchRow + matchHeight,
        component: hasReverseFinal
          ? round.type === DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.REVERSE_FINAL
            ? options.finalMatchComponent
            : options.matchComponent
          : round.type === COMMON_BRACKET_ROUND_TYPE.FINAL
            ? options.finalMatchComponent
            : options.matchComponent,
        matchRelation,
        roundRelation,
        className: `et-bracket-new-item et-bracket-match-container ${participantShortIds}`,
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

const generateSwissWithEliminationGridPlacements = <TRoundData, TMatchData>(
  config: GridPlacementGeneratorConfig<TRoundData, TMatchData>,
) => {
  const { swissGroups } = config;

  if (!swissGroups) throw new Error('Swiss groups are required for swiss with elimination mode');

  const gridItems: Map<BracketRoundId, BracketGridRoundItem<TRoundData, TMatchData>> = new Map();

  return gridItems;
};
