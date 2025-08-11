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

export type MutableBracketMasterColumnSection = {
  masterColumnSection: BracketMasterColumnSection;
  pushSubColumn: (subColumn: BracketSubColumn) => void;
};

export const createBracketMasterColumnSection = (
  config: CreateBracketMasterColumnSectionConfig,
): MutableBracketMasterColumnSection => {
  const { masterColumn, type } = config;

  const subColumns: BracketSubColumn[] = [];

  const newMasterColumnSection: BracketMasterColumnSection = {
    dimensions: {
      width: masterColumn.dimensions.width,
      height: 0,
      top: 0,
      left: 0,
    },
    subColumns,
    type,
  };

  const pushSubColumn = (subColumn: BracketSubColumn) => {
    subColumns.push(subColumn);
  };

  return {
    masterColumnSection: newMasterColumnSection,
    pushSubColumn,
  };
};
