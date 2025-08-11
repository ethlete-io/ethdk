import { BracketElement, BracketElementPart, BracketSubColumn } from './types';

export type CreateBracketElementPartConfig = {
  subColumn: BracketSubColumn;
  element: BracketElement;
  elementPartHeight: number;
};

export const createBracketElementPart = (config: CreateBracketElementPartConfig) => {
  const { subColumn, elementPartHeight, element } = config;

  const newElementPart: BracketElementPart = {
    dimensions: {
      width: subColumn.dimensions.width,
      height: elementPartHeight,
      top: 0,
      left: subColumn.dimensions.left,
    },
  };

  return {
    elementPart: newElementPart,
  };
};
