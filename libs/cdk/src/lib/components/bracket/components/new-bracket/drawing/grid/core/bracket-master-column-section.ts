import {
  BracketMasterColumn,
  BracketMasterColumnSection,
  BracketMasterColumnSectionType,
  BracketSubColumn,
} from './types';

export type CreateBracketMasterColumnSectionConfig = {
  masterColumn: BracketMasterColumn;
  type: BracketMasterColumnSectionType;
};

export const createBracketMasterColumnSection = (config: CreateBracketMasterColumnSectionConfig) => {
  const { masterColumn, type } = config;

  const currentTop = masterColumn.sections.reduce((sum, section) => sum + section.dimensions.height, 0);

  const newMasterColumnSection: BracketMasterColumnSection = {
    dimensions: {
      width: masterColumn.dimensions.width,
      height: 0,
      top: currentTop,
      left: masterColumn.dimensions.left,
    },
    subColumns: [],
    type,
  };

  const pushSubColumn = (subColumn: BracketSubColumn) => {
    newMasterColumnSection.subColumns.push(subColumn);
  };

  return {
    masterColumnSection: newMasterColumnSection,
    pushSubColumn,
  };
};
