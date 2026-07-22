import { Dimensions } from './types';

export type CreateBracketElementPartConfig = {
  elementPartHeight: number;
};

/**
 * A row is a part of an element.
 */
export type BracketElementPart = {
  dimensions: Dimensions;
};

export const createBracketElementPart = (config: CreateBracketElementPartConfig) => {
  const { elementPartHeight } = config;

  const newElementPart: BracketElementPart = {
    dimensions: {
      width: 0,
      height: elementPartHeight,
      top: 0,
      left: 0,
    },
  };

  return {
    elementPart: newElementPart,
  };
};
