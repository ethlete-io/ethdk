import {
  BracketElement,
  BracketElementPart,
  BracketMasterColumn,
  BracketMasterColumnSection,
  BracketSubColumn,
} from './types';

export type CreateBracketElementPartConfig = {
  masterColumn: BracketMasterColumn;
  masterColumnSection: BracketMasterColumnSection;
  subColumn: BracketSubColumn;
  element: BracketElement;
  elementPartHeight: number;
};

export const createBracketElementPart = (config: CreateBracketElementPartConfig) => {
  const { masterColumn, masterColumnSection, subColumn, elementPartHeight, element } = config;

  const currentTop =
    element.parts.reduce((sum, part) => sum + part.dimensions.height, 0) + element.containerDimensions.top;

  const newElementPart: BracketElementPart = {
    dimensions: {
      width: subColumn.dimensions.width,
      height: elementPartHeight,
      top: currentTop,
      left: subColumn.dimensions.left,
    },
  };

  return {
    elementPart: newElementPart,
  };
};
