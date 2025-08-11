import {
  BracketElement,
  BracketElementPart,
  BracketElementType,
  BracketMasterColumn,
  BracketMasterColumnSection,
  BracketSubColumn,
} from './types';

export type CreateBracketElementConfig = {
  masterColumn: BracketMasterColumn;
  masterColumnSection: BracketMasterColumnSection;
  subColumn: BracketSubColumn;
  type: BracketElementType;
  area: string;
  elementHeight: number;
  isFirstSubColumn: boolean;
};

export const createBracketElement = (config: CreateBracketElementConfig) => {
  const { masterColumn, masterColumnSection, subColumn, type, area, elementHeight, isFirstSubColumn } = config;

  const currentTop = subColumn.elements.reduce((sum, element) => sum + element.containerDimensions.height, 0);

  const newElement: BracketElement = {
    dimensions: {
      width: subColumn.dimensions.width,
      height: elementHeight,
      top: 0,
      left: subColumn.dimensions.left,
    },
    containerDimensions: {
      width: subColumn.dimensions.width,
      height: 0,
      top: currentTop,
      left: subColumn.dimensions.left,
    },
    parts: [],
    type,
    area,
  };

  const pushPart = (part: BracketElementPart) => {
    const newPartHeight = part.dimensions.height;
    const totalElementHeight = newPartHeight + newElement.containerDimensions.height;

    const elementStart = newElement.containerDimensions.top;
    const elementHalfHeight = newElement.dimensions.height / 2;

    newElement.containerDimensions.height = totalElementHeight;

    newElement.dimensions.top = elementStart + totalElementHeight / 2 - elementHalfHeight;

    subColumn.dimensions.height += newPartHeight;

    if (isFirstSubColumn) {
      masterColumn.dimensions.height += newPartHeight;
      masterColumnSection.dimensions.height += newPartHeight;
    }

    newElement.parts.push(part);
  };

  return {
    element: newElement,
    pushPart,
  };
};
