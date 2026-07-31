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
import { BRACKET_DENSITY_PRESETS } from './bracket-density';
import { BRACKET_DEFAULTS, BracketLayoutConfig } from './bracket.config';
import { BRACKET_DATA_LAYOUT } from './core/layout';

/**
 * Every layout setting, resolved to a concrete value — no `undefined`, no "fall back to the config".
 * Produced by {@link resolveBracketLayoutSettings}.
 *
 * @internal
 */
export type BracketLayoutSettings = Required<BracketLayoutConfig>;

const LAYOUT_KEYS = Object.keys(BRACKET_DEFAULTS) as (keyof BracketLayoutSettings)[];

/**
 * Resolves a partial config in the order the bracket documents: what you set, then the density preset,
 * then {@link BRACKET_DEFAULTS}.
 *
 * @internal
 */
export const resolveBracketLayoutSettings = (config: BracketLayoutConfig): BracketLayoutSettings => {
  const settings: BracketLayoutSettings = {
    ...BRACKET_DEFAULTS,
    ...BRACKET_DENSITY_PRESETS[config.density ?? BRACKET_DEFAULTS.density],
  };

  // Key by key rather than one spread: a config carrying an explicit `undefined` (which is what an
  // unbound component input hands over) must leave the preset's value standing, not clobber it.
  for (const key of LAYOUT_KEYS) {
    const value = config[key];

    if (value !== undefined) {
      (settings as Record<string, unknown>)[key] = value;
    }
  }

  return settings;
};

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
