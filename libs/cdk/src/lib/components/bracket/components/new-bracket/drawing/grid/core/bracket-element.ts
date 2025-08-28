import { BracketElement, BracketElementPart, BracketElementType } from './types';

export type CreateBracketElementConfig = {
  type: BracketElementType;
  area: string;
  elementHeight: number;
};

export type MutableBracketElement = {
  element: BracketElement;
  pushPart: (...part: BracketElementPart[]) => void;
};

export const createBracketElement = (config: CreateBracketElementConfig): MutableBracketElement => {
  const { type, area, elementHeight } = config;

  const parts: BracketElementPart[] = [];

  const newElement: BracketElement = {
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
    type,
    area,
  };

  const pushPart = (...newParts: BracketElementPart[]) => {
    parts.push(...newParts);
  };

  return {
    element: newElement,
    pushPart,
  };
};
