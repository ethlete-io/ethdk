import { TOURNAMENT_MODE } from './core';
import {
  BracketComponents,
  ComputedBracketGrid,
  CreateBracketGridConfig,
  createDoubleEliminationGrid,
  createSingleEliminationGrid,
  createSwissGrid,
} from './drawing/grid';
import { Bracket } from './linked';
import { BRACKET_DEFAULTS, BracketConfig } from './bracket.config';
import { BRACKET_DATA_LAYOUT } from './core/layout';

/**
 * Every layout setting the grid builders need, already resolved to a concrete value — no `undefined`,
 * no "fall back to the config". A component resolves this from its inputs; a standalone helper resolves
 * it from a {@link BracketConfig} with {@link resolveBracketLayoutSettings}.
 *
 * @internal
 */
export type BracketLayoutSettings = Pick<
  Required<BracketConfig>,
  | 'columnWidth'
  | 'matchHeight'
  | 'finalMatchHeight'
  | 'finalColumnWidth'
  | 'roundHeaderHeight'
  | 'roundHeaderGap'
  | 'columnGap'
  | 'rowGap'
  | 'rowRoundGap'
  | 'lineWidth'
  | 'layout'
  | 'hideRoundHeaders'
  | 'showContinueElement'
  | 'continueColumnWidth'
  | 'continueElementHeight'
  | 'swissGroupPadding'
>;

/** Fills a partial {@link BracketConfig} out with {@link BRACKET_DEFAULTS}. @internal */
export const resolveBracketLayoutSettings = (config: BracketConfig): BracketLayoutSettings => ({
  columnWidth: config.columnWidth ?? BRACKET_DEFAULTS.columnWidth,
  matchHeight: config.matchHeight ?? BRACKET_DEFAULTS.matchHeight,
  finalMatchHeight: config.finalMatchHeight ?? BRACKET_DEFAULTS.finalMatchHeight,
  finalColumnWidth: config.finalColumnWidth ?? BRACKET_DEFAULTS.finalColumnWidth,
  roundHeaderHeight: config.roundHeaderHeight ?? BRACKET_DEFAULTS.roundHeaderHeight,
  roundHeaderGap: config.roundHeaderGap ?? BRACKET_DEFAULTS.roundHeaderGap,
  columnGap: config.columnGap ?? BRACKET_DEFAULTS.columnGap,
  rowGap: config.rowGap ?? BRACKET_DEFAULTS.rowGap,
  rowRoundGap: config.rowRoundGap ?? BRACKET_DEFAULTS.rowRoundGap,
  lineWidth: config.lineWidth ?? BRACKET_DEFAULTS.lineWidth,
  layout: config.layout ?? BRACKET_DEFAULTS.layout,
  hideRoundHeaders: config.hideRoundHeaders ?? BRACKET_DEFAULTS.hideRoundHeaders,
  showContinueElement: config.showContinueElement ?? BRACKET_DEFAULTS.showContinueElement,
  continueColumnWidth: config.continueColumnWidth ?? BRACKET_DEFAULTS.continueColumnWidth,
  continueElementHeight: config.continueElementHeight ?? BRACKET_DEFAULTS.continueElementHeight,
  swissGroupPadding: config.swissGroupPadding ?? BRACKET_DEFAULTS.swissGroupPadding,
});

/**
 * Translates the resolved settings into what the grid builders take — the two differ where a flag zeroes
 * a measurement (hidden round headers) or turns a pair of them into an object (the continue column).
 *
 * @internal
 */
export const createBracketGridConfig = (settings: BracketLayoutSettings): CreateBracketGridConfig => ({
  includeRoundHeaders: !settings.hideRoundHeaders,
  columnGap: settings.columnGap,
  rowRoundGap: settings.rowRoundGap,
  columnWidth: settings.columnWidth,
  matchHeight: settings.matchHeight,
  roundHeaderHeight: settings.hideRoundHeaders ? 0 : settings.roundHeaderHeight,
  rowGap: settings.rowGap,
  layout: settings.layout,
  finalMatchHeight: settings.finalMatchHeight,
  finalColumnWidth: settings.finalColumnWidth,
  roundHeaderGap: settings.hideRoundHeaders ? 0 : settings.roundHeaderGap,
  swissGroupPadding: settings.swissGroupPadding,
  swissGroupBorderWidth: settings.lineWidth,
  continueElement:
    settings.showContinueElement && settings.layout === BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT
      ? {
          columnWidth: settings.continueColumnWidth,
          elementHeight: settings.continueElementHeight,
        }
      : null,
});

/**
 * Builds the positioned grid for a linked bracket — one entry point over the three per-mode builders.
 *
 * @internal
 */
export const computeBracketGrid = <TRoundData, TMatchData>(
  bracketData: Bracket<TRoundData, TMatchData>,
  options: CreateBracketGridConfig,
  components: BracketComponents<TRoundData, TMatchData>,
  // eslint-disable-next-line max-params -- grid builder signature (data, options, components)
): ComputedBracketGrid<TRoundData, TMatchData> => {
  switch (bracketData.mode) {
    case TOURNAMENT_MODE.DOUBLE_ELIMINATION:
      return createDoubleEliminationGrid(bracketData, options, components);

    case TOURNAMENT_MODE.SINGLE_ELIMINATION:
      return createSingleEliminationGrid(bracketData, options, components);

    case TOURNAMENT_MODE.SWISS_WITH_ELIMINATION:
      return createSwissGrid(bracketData, options, components);
  }
};
