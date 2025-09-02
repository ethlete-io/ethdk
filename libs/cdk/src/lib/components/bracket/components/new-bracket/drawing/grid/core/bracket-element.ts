import { BracketMatchComponent, BracketRoundHeaderComponent } from '../../../grid-placements';
import { NewBracketMatch, NewBracketRound } from '../../../linked';
import { BracketElementPart, createBracketElementPart } from './bracket-element-part';
import { Dimensions } from './types';

/**
 * An element is a slice of a section.
 * It can be a match, a header, a gap, etc.
 */
export type BracketElementBase = {
  area: string;

  /** The dimensions of the actual element */
  dimensions: Dimensions;

  /** The dimensions of the container that holds the element */
  containerDimensions: Dimensions;

  parts: ReadonlyArray<BracketElementPart>;

  span?: BracketElementSpanCoordinates;

  isHidden?: boolean;
};

export type HeaderBracketElement<TRoundData, TMatchData> = BracketElementBase &
  HeaderBracketElementDetails<TRoundData, TMatchData>;

export type MatchBracketElement<TRoundData, TMatchData> = BracketElementBase &
  MatchBracketElementDetails<TRoundData, TMatchData>;

export type GapBracketElement = BracketElementBase & GapBracketElementDetails;

export type BracketElement<TRoundData, TMatchData> =
  | HeaderBracketElement<TRoundData, TMatchData>
  | MatchBracketElement<TRoundData, TMatchData>
  | GapBracketElement;

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
  round: NewBracketRound<TRoundData, TMatchData>;
};

export type HeaderBracketElementToCreate<TRoundData, TMatchData> = BracketElementToCreateBase &
  HeaderBracketElementDetails<TRoundData, TMatchData>;

type MatchBracketElementDetails<TRoundData, TMatchData> = {
  type: 'match';
  component: BracketMatchComponent<TRoundData, TMatchData>;
  match: NewBracketMatch<TRoundData, TMatchData>;
  round: NewBracketRound<TRoundData, TMatchData>;
};

export type MatchBracketElementToCreate<TRoundData, TMatchData> = BracketElementToCreateBase &
  MatchBracketElementDetails<TRoundData, TMatchData>;

export type GapBracketElementDetails = {
  type: 'matchGap' | 'roundHeaderGap' | 'roundGap' | 'colGap';
};

export type GapBracketElementToCreate = BracketElementToCreateBase & GapBracketElementDetails;

export type BracketElementToCreate<TRoundData, TMatchData> =
  | HeaderBracketElementToCreate<TRoundData, TMatchData>
  | MatchBracketElementToCreate<TRoundData, TMatchData>
  | GapBracketElementToCreate;

export type BracketElementType =
  | HeaderBracketElementToCreate<any, any>['type']
  | MatchBracketElementToCreate<any, any>['type']
  | GapBracketElementToCreate['type'];

export type MutableBracketElement<TRoundData, TMatchData> = {
  element: BracketElement<TRoundData, TMatchData>;
};

export const createBracketElement = <TRoundData, TMatchData>(
  config: BracketElementToCreate<TRoundData, TMatchData>,
): MutableBracketElement<TRoundData, TMatchData> => {
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
        } satisfies HeaderBracketElement<TRoundData, TMatchData>;
      case 'match':
        return {
          ...newElementBase,
          type,
          component: config.component,
          match: config.match,
          round: config.round,
        } satisfies MatchBracketElement<TRoundData, TMatchData>;
      case 'matchGap':
      case 'roundHeaderGap':
      case 'roundGap':
      case 'colGap':
        return {
          ...newElementBase,
          type,
        } satisfies GapBracketElement;
      default:
        throw new Error(`Unknown element type: ${type as unknown as string}`);
    }
  })();

  const pushPart = (...newParts: BracketElementPart[]) => {
    parts.push(...newParts);
  };

  for (const partHeight of partHeights) {
    const { elementPart } = createBracketElementPart({
      elementPartHeight: partHeight,
    });
    pushPart(elementPart);
  }

  return {
    element: newElement,
  };
};
