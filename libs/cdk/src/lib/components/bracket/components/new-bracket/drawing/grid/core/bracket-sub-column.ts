import { BracketElement } from './bracket-element';
import { Dimensions } from './types';

export type BracketSubColumn<TRoundData, TMatchData> = {
  dimensions: Dimensions;
  elements: ReadonlyArray<BracketElement<TRoundData, TMatchData>>;
  span: BracketSubColumnSpan;
};

export type BracketSubColumnSpan = {
  isStart: boolean;
  isEnd: boolean;
};

export type CreateBracketSubColumnConfig = {
  span: BracketSubColumnSpan;
};

export type MutableBracketSubColumn<TRoundData, TMatchData> = {
  subColumn: BracketSubColumn<TRoundData, TMatchData>;
  pushElement: (...elements: BracketElement<TRoundData, TMatchData>[]) => void;
};

export const createBracketSubColumn = <TRoundData, TMatchData>(
  config: CreateBracketSubColumnConfig,
): MutableBracketSubColumn<TRoundData, TMatchData> => {
  const { span } = config;

  const elements: BracketElement<TRoundData, TMatchData>[] = [];

  const newSubColumn: BracketSubColumn<TRoundData, TMatchData> = {
    dimensions: {
      width: 0,
      height: 0,
      top: 0,
      left: 0,
    },
    elements,
    span,
  };

  const pushElement = (...newElements: BracketElement<TRoundData, TMatchData>[]) => {
    elements.push(...newElements);
  };

  return {
    subColumn: newSubColumn,
    pushElement,
  };
};
