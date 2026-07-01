import { BracketSubColumn } from './bracket-sub-column';
import { Dimensions, Spacing } from './types';

export type BracketMasterColumnSectionType = 'round' | 'gap';

export type BracketMasterColumnSection<TRoundData, TMatchData> = {
  subColumns: ReadonlyArray<BracketSubColumn<TRoundData, TMatchData>>;
  dimensions: Dimensions;
  type: BracketMasterColumnSectionType;

  /** Overrides the master column padding for this section */
  padding?: Spacing;
};

export type CreateBracketMasterColumnSectionConfig = {
  type: BracketMasterColumnSectionType;
  padding?: Spacing;
};

export type MutableBracketMasterColumnSection<TRoundData, TMatchData> = {
  masterColumnSection: BracketMasterColumnSection<TRoundData, TMatchData>;
  pushSubColumn: (...subColumns: BracketSubColumn<TRoundData, TMatchData>[]) => void;
};

export const createBracketMasterColumnSection = <TRoundData, TMatchData>(
  config: CreateBracketMasterColumnSectionConfig,
): MutableBracketMasterColumnSection<TRoundData, TMatchData> => {
  const { type, padding } = config;

  const subColumns: BracketSubColumn<TRoundData, TMatchData>[] = [];

  const newMasterColumnSection: BracketMasterColumnSection<TRoundData, TMatchData> = {
    dimensions: {
      width: 0,
      height: 0,
      top: 0,
      left: 0,
    },
    subColumns,
    type,
    padding,
  };

  const pushSubColumn = (...newSubColumns: BracketSubColumn<TRoundData, TMatchData>[]) => {
    subColumns.push(...newSubColumns);
  };

  return {
    masterColumnSection: newMasterColumnSection,
    pushSubColumn,
  };
};
