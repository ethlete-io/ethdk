import { Dimensions } from './types';

export type CreateBracketElementPartConfig = {
  elementPartHeight: number;
};

export type BracketElementPart = {
  dimensions: Dimensions;
};

export const createBracketElementPart = (config: CreateBracketElementPartConfig): BracketElementPart => ({
  dimensions: {
    width: 0,
    height: config.elementPartHeight,
    top: 0,
    left: 0,
  },
});
