import { BracketMasterColumn, BracketMasterColumnSection } from './types';

export type CreateBracketMasterColumnConfig = {
  existingMasterColumns: BracketMasterColumn[];
  columnWidth: number;
};

export const createBracketMasterColumn = (config: CreateBracketMasterColumnConfig) => {
  const { existingMasterColumns, columnWidth } = config;
  const currentLeft = existingMasterColumns.reduce((sum, column) => sum + column.dimensions.width, 0);

  const newMasterColumn: BracketMasterColumn = {
    dimensions: {
      width: columnWidth,
      height: 0,
      top: 0,
      left: currentLeft,
    },
    sections: [],
  };

  const pushSection = (section: BracketMasterColumnSection) => {
    newMasterColumn.sections.push(section);
  };

  return {
    masterColumn: newMasterColumn,
    pushSection,
  };
};
