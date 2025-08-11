import { BracketMasterColumn, BracketMasterColumnSection } from './types';

export type CreateBracketMasterColumnConfig = {
  columnWidth: number;
};

export type MutableBracketMasterColumn = {
  masterColumn: BracketMasterColumn;
  pushSection: (section: BracketMasterColumnSection) => void;
};

export const createBracketMasterColumn = (config: CreateBracketMasterColumnConfig): MutableBracketMasterColumn => {
  const { columnWidth } = config;

  const sections: BracketMasterColumnSection[] = [];

  const newMasterColumn: BracketMasterColumn = {
    dimensions: {
      width: columnWidth,
      height: 0,
      top: 0,
      left: 0,
    },
    sections,
  };

  const pushSection = (section: BracketMasterColumnSection) => {
    sections.push(section);
  };

  return {
    masterColumn: newMasterColumn,
    pushSection,
  };
};
