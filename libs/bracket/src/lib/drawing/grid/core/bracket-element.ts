import { BracketRoundSwissGroup, BracketMatch, BracketRound } from '../../../linked';
import { BracketElementPart, createBracketElementPart } from './bracket-element-part';
import { BracketContinueComponent, BracketMatchComponent, BracketRoundHeaderComponent, Dimensions } from './types';
import { BracketRuntimeError } from '../../../bracket-runtime-error';
import { BRACKET_ERROR_CODES } from '../../../bracket-errors';

export type BracketElementBase = {
  area: string;
  dimensions: Dimensions;
  containerDimensions: Dimensions;

  parts: ReadonlyArray<BracketElementPart>;

  span?: BracketElementSpanCoordinates;
};

export type HeaderBracketElement<TRoundData, TMatchData> = BracketElementBase &
  HeaderBracketElementDetails<TRoundData, TMatchData>;

export type MatchBracketElement<TRoundData, TMatchData> = BracketElementBase &
  MatchBracketElementDetails<TRoundData, TMatchData>;

export type GapBracketElement = BracketElementBase & GapBracketElementDetails;

export type ContinueBracketElement<TRoundData, TMatchData> = BracketElementBase &
  ContinueBracketElementDetails<TRoundData, TMatchData>;

export type BracketElement<TRoundData, TMatchData> =
  | HeaderBracketElement<TRoundData, TMatchData>
  | MatchBracketElement<TRoundData, TMatchData>
  | GapBracketElement
  | ContinueBracketElement<TRoundData, TMatchData>;

export type BracketElementSpanCoordinates = {
  masterColumnStart: number;
  masterColumnEnd: number;
  sectionStart: number;
  sectionEnd: number;
  subColumnStart: number;
  subColumnEnd: number;
};

export type BracketElementToCreateBase = {
  area: string;
  partHeights: number[];
  elementHeight: number;
};

export type HeaderBracketElementDetails<TRoundData, TMatchData> = {
  type: 'header';
  component: BracketRoundHeaderComponent<TRoundData, TMatchData>;
  round: BracketRound<TRoundData, TMatchData>;
  roundSwissGroup: BracketRoundSwissGroup<TRoundData, TMatchData> | null;
};

export type HeaderBracketElementToCreate<TRoundData, TMatchData> = BracketElementToCreateBase &
  HeaderBracketElementDetails<TRoundData, TMatchData>;

type MatchBracketElementDetails<TRoundData, TMatchData> = {
  type: 'match';
  component: BracketMatchComponent<TRoundData, TMatchData>;
  match: BracketMatch<TRoundData, TMatchData>;
  round: BracketRound<TRoundData, TMatchData>;
  roundSwissGroup: BracketRoundSwissGroup<TRoundData, TMatchData> | null;
};

export type MatchBracketElementToCreate<TRoundData, TMatchData> = BracketElementToCreateBase &
  MatchBracketElementDetails<TRoundData, TMatchData>;

export type GapBracketElementDetails = {
  type: 'matchGap' | 'roundHeaderGap' | 'roundGap' | 'colGap';
};

export type GapBracketElementToCreate = BracketElementToCreateBase & GapBracketElementDetails;

export type ContinueBracketElementDetails<TRoundData, TMatchData> = {
  type: 'continue';
  component: BracketContinueComponent<TRoundData, TMatchData>;
  matches: BracketMatch<TRoundData, TMatchData>[];
};

export type ContinueBracketElementToCreate<TRoundData, TMatchData> = BracketElementToCreateBase &
  ContinueBracketElementDetails<TRoundData, TMatchData>;

export type BracketElementToCreate<TRoundData, TMatchData> =
  | HeaderBracketElementToCreate<TRoundData, TMatchData>
  | MatchBracketElementToCreate<TRoundData, TMatchData>
  | GapBracketElementToCreate
  | ContinueBracketElementToCreate<TRoundData, TMatchData>;

export const createBracketElement = <TRoundData, TMatchData>(
  config: BracketElementToCreate<TRoundData, TMatchData>,
): BracketElement<TRoundData, TMatchData> => {
  const { type, area, elementHeight, partHeights } = config;

  const parts: BracketElementPart[] = [];

  const newElementBase: BracketElementBase = {
    dimensions: {
      width: 0,
      height: elementHeight,
      top: 0,
      left: 0,
    },
    containerDimensions: {
      width: 0,
      height: 0,
      top: 0,
      left: 0,
    },
    parts,
    area,
  };

  const newElement: BracketElement<TRoundData, TMatchData> = (() => {
    switch (type) {
      case 'header':
        return {
          ...newElementBase,
          type,
          component: config.component,
          round: config.round,
          roundSwissGroup: config.roundSwissGroup,
        } satisfies HeaderBracketElement<TRoundData, TMatchData>;
      case 'match':
        return {
          ...newElementBase,
          type,
          component: config.component,
          match: config.match,
          round: config.round,
          roundSwissGroup: config.roundSwissGroup,
        } satisfies MatchBracketElement<TRoundData, TMatchData>;
      case 'matchGap':
      case 'roundHeaderGap':
      case 'roundGap':
      case 'colGap':
        return {
          ...newElementBase,
          type,
        } satisfies GapBracketElement;
      case 'continue':
        return {
          ...newElementBase,
          type,
          component: config.component,
          matches: config.matches,
        } satisfies ContinueBracketElement<TRoundData, TMatchData>;
      default:
        throw new BracketRuntimeError(
          BRACKET_ERROR_CODES.GRID_INVALID,
          `Unknown element type: ${type as unknown as string}`,
        );
    }
  })();

  for (const partHeight of partHeights) {
    parts.push(createBracketElementPart({ elementPartHeight: partHeight }));
  }

  return newElement;
};
