import { createStaticRootProvider } from '@ethlete/core';
import { BracketDataLayout } from './core';
import { BracketContinueComponent, BracketMatchComponent, BracketRoundHeaderComponent } from './drawing/grid';
import { BracketSwissGroupColorType } from './linked';

/**
 * Colors for the swiss group borders and connection lines, keyed by the group color type
 * (see getSwissGroupColorType). Connection lines are drawn in the neutral color and fade
 * into the target group color on the last portion before touching its border.
 * Any CSS color value is allowed. Missing entries fall back to the connector/border color
 * (the `--et-bracket-line-color` / `--et-bracket-swiss-group-border-color` custom properties,
 * which default to `--et-surface-border-solid`).
 */
export type BracketSwissColors = Partial<Record<BracketSwissGroupColorType, string>>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BracketSwissConfig<TRoundData = any, TMatchData = any> = {
  roundHeaderComponent?: BracketRoundHeaderComponent<TRoundData, TMatchData>;
  matchComponent?: BracketMatchComponent<TRoundData, TMatchData>;
  colors?: BracketSwissColors;
};

/**
 * Default values for the et-bracket component inputs. Inputs set on the component
 * always win over the config.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BracketConfig<TRoundData = any, TMatchData = any> = {
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
  showContinueElement?: boolean;
  continueColumnWidth?: number;
  continueElementHeight?: number;
  continueLineDashArray?: number;

  roundHeaderComponent?: BracketRoundHeaderComponent<TRoundData, TMatchData>;
  matchComponent?: BracketMatchComponent<TRoundData, TMatchData>;
  finalMatchComponent?: BracketMatchComponent<TRoundData, TMatchData>;
  continueComponent?: BracketContinueComponent<TRoundData, TMatchData>;

  /** Swiss specific overrides. These win over the top level component defaults. */
  swiss?: BracketSwissConfig<TRoundData, TMatchData>;
};

export const [provideBracketConfig, injectBracketConfig] = createStaticRootProvider<BracketConfig>(
  {},
  { name: 'BracketConfig' },
);
