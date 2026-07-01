import { createStaticRootProvider } from '@ethlete/core';
import { BracketDataLayout } from './core';
import { BracketMatchComponent, BracketRoundHeaderComponent } from './drawing/grid';
import { BracketSwissGroupColorType } from './linked';

/**
 * Colors for the swiss group borders, headers and connection lines, keyed by the group
 * color type (see getSwissGroupColorType). Connection lines between two differently
 * colored groups are drawn with a gradient from the source to the target color.
 * Any CSS color value is allowed. Missing entries fall back to `currentColor`
 * (the `--bracket-line-color` / `--bracket-swiss-group-border-color` custom properties).
 */
export type BracketSwissColors = Partial<Record<BracketSwissGroupColorType, string>>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BracketSwissConfig<TRoundData = any, TMatchData = any> = {
  roundHeaderComponent?: BracketRoundHeaderComponent<TRoundData, TMatchData>;
  matchComponent?: BracketMatchComponent<TRoundData, TMatchData>;
  colors?: BracketSwissColors;
};

/**
 * Default values for the et-new-bracket component inputs. Inputs set on the component
 * always win over the config.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type NewBracketConfig<TRoundData = any, TMatchData = any> = {
  columnWidth?: number;
  matchHeight?: number;
  finalMatchHeight?: number;
  finalColumnWidth?: number;
  roundHeaderHeight?: number;
  roundHeaderGap?: number;
  columnGap?: number;
  rowGap?: number;
  rowRoundGap?: number;
  lineStartingCurveAmount?: number;
  lineEndingCurveAmount?: number;
  lineWidth?: number;
  lineDashArray?: number;
  lineDashOffset?: number;
  disableJourneyHighlight?: boolean;
  swissGroupPadding?: number;
  swissGroupBorderRadius?: number;
  layout?: BracketDataLayout;
  hideRoundHeaders?: boolean;

  roundHeaderComponent?: BracketRoundHeaderComponent<TRoundData, TMatchData>;
  matchComponent?: BracketMatchComponent<TRoundData, TMatchData>;
  finalMatchComponent?: BracketMatchComponent<TRoundData, TMatchData>;

  /** Swiss specific overrides. These win over the top level component defaults. */
  swiss?: BracketSwissConfig<TRoundData, TMatchData>;
};

export const [provideNewBracketConfig, injectNewBracketConfig] = createStaticRootProvider<NewBracketConfig>(
  {},
  { name: 'NewBracketConfig' },
);
