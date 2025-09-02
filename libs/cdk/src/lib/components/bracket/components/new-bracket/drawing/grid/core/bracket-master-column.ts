import { BracketMasterColumnSection } from './bracket-master-column-section';
import { Dimensions } from './types';

export type BracketMasterColumn<TRoundData, TMatchData> = {
  sections: ReadonlyArray<BracketMasterColumnSection<TRoundData, TMatchData>>;
  dimensions: Dimensions;
};

export type CreateBracketMasterColumnConfig = {
  columnWidth: number;
};

export type MutableBracketMasterColumn<TRoundData, TMatchData> = {
  masterColumn: BracketMasterColumn<TRoundData, TMatchData>;
  pushSection: (...sections: BracketMasterColumnSection<TRoundData, TMatchData>[]) => void;
};

export const createBracketMasterColumn = <TRoundData, TMatchData>(
  config: CreateBracketMasterColumnConfig,
): MutableBracketMasterColumn<TRoundData, TMatchData> => {
  const { columnWidth } = config;

  const sections: BracketMasterColumnSection<TRoundData, TMatchData>[] = [];

  const newMasterColumn: BracketMasterColumn<TRoundData, TMatchData> = {
    dimensions: {
      width: columnWidth,
      height: 0,
      top: 0,
      left: 0,
    },
    sections,
  };

  const pushSection = (...newSections: BracketMasterColumnSection<TRoundData, TMatchData>[]) => {
    sections.push(...newSections);
  };

  return {
    masterColumn: newMasterColumn,
    pushSection,
  };
};
