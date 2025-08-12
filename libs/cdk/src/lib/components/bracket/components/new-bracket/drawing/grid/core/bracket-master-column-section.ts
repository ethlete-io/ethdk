import { BracketMasterColumnSection, BracketMasterColumnSectionType, BracketSubColumn } from './types';

export type CreateBracketMasterColumnSectionConfig = {
  type: BracketMasterColumnSectionType;
};

export type MutableBracketMasterColumnSection = {
  masterColumnSection: BracketMasterColumnSection;
  pushSubColumn: (...subColumns: BracketSubColumn[]) => void;
};

export const createBracketMasterColumnSection = (
  config: CreateBracketMasterColumnSectionConfig,
): MutableBracketMasterColumnSection => {
  const { type } = config;

  const subColumns: BracketSubColumn[] = [];

  const newMasterColumnSection: BracketMasterColumnSection = {
    dimensions: {
      width: 0,
      height: 0,
      top: 0,
      left: 0,
    },
    subColumns,
    type,
  };

  const pushSubColumn = (...newSubColumns: BracketSubColumn[]) => {
    subColumns.push(...newSubColumns);
  };

  return {
    masterColumnSection: newMasterColumnSection,
    pushSubColumn,
  };
};
