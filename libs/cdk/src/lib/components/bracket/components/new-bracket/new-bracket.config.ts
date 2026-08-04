import { defineStaticRootProvider, toInjectFn, toProvideFn } from '@ethlete/core';
import { BracketDataLayout } from './core';
import { BracketContinueComponent, BracketMatchComponent, BracketRoundHeaderComponent } from './drawing/grid';
import { BracketSwissGroupColorType } from './linked';

/**
 * Colors for the swiss group borders and connection lines, keyed by the group color type
 * (see getSwissGroupColorType). Connection lines are drawn in the neutral color and fade
 * into the target group color on the last portion before touching its border.
 * Any CSS color value is allowed. Missing entries fall back to `currentColor`
 * (the `--bracket-line-color` / `--bracket-swiss-group-border-color` custom properties).
 *
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export type BracketSwissColors = Partial<Record<BracketSwissGroupColorType, string>>;

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export type BracketSwissConfig<TRoundData = any, TMatchData = any> = {
  roundHeaderComponent?: BracketRoundHeaderComponent<TRoundData, TMatchData>;
  matchComponent?: BracketMatchComponent<TRoundData, TMatchData>;
  colors?: BracketSwissColors;
};

/**
 * Default values for the et-new-bracket component inputs. Inputs set on the component
 * always win over the config.
 *
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
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

const NEW_BRACKET_CONFIG_DEF = /* @__PURE__ */ defineStaticRootProvider<NewBracketConfig>(
  {},
  { name: 'NewBracketConfig' },
);

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const provideNewBracketConfig = /* @__PURE__ */ toProvideFn(NEW_BRACKET_CONFIG_DEF);
/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const injectNewBracketConfig = /* @__PURE__ */ toInjectFn(NEW_BRACKET_CONFIG_DEF);
