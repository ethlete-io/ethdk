import { BracketElement, BracketMasterColumn, BracketMasterColumnSection, BracketSubColumn, Span } from './types';

export type CreateBracketSubColumnConfig = {
  masterColumn: BracketMasterColumn;
  masterColumnSection: BracketMasterColumnSection;
  totalSubColumns: number;
  span: Span;
};

export const createBracketSubColumn = (config: CreateBracketSubColumnConfig) => {
  const { masterColumn, masterColumnSection, totalSubColumns, span } = config;

  const currentTop = masterColumn.sections.reduce((sum, section) => sum + section.dimensions.height, 0);
  const currentLeft =
    masterColumnSection.dimensions.left +
    masterColumnSection.subColumns.reduce((sum, subColumn) => sum + subColumn.dimensions.width, 0);

  const newSubColumn: BracketSubColumn = {
    dimensions: {
      width: masterColumnSection.dimensions.width / totalSubColumns,
      height: 0,
      top: currentTop,
      left: currentLeft,
    },
    elements: [],
    span,
  };

  const pushElement = (element: BracketElement) => {
    newSubColumn.elements.push(element);
  };

  return {
    subColumn: newSubColumn,
    pushElement,
  };
};
