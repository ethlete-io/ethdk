import { BRACKET_DENSITY_PRESETS } from './bracket-density';
import { BRACKET_DEFAULTS, BracketLayoutConfig } from './bracket.config';
import { BRACKET_DATA_LAYOUT, BracketDataLayout, CreateBracketGridConfig } from '@ethlete/bracket';

/**
 * Every layout setting, resolved to a concrete value - no `undefined`, no "fall back to the config".
 * Produced by {@link resolveBracketLayoutSettings}.
 */
export type BracketLayoutSettings = Required<BracketLayoutConfig>;

const LAYOUT_KEYS = /* @__PURE__ */ Object.keys(BRACKET_DEFAULTS) as (keyof BracketLayoutSettings)[];

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

  for (const key of LAYOUT_KEYS) {
    const value = config[key];

    if (value !== undefined) {
      (settings as Record<string, unknown>)[key] = value;
    }
  }

  return settings;
};

/**
 * Translates the resolved settings into what the grid builders take - the two differ where a flag zeroes
 * a measurement (hidden round headers) or turns a pair of them into an object (the continue column).
 * The data layout comes from the active {@link BracketLayout}, not from the settings.
 *
 * @internal
 */
export const createBracketGridConfig = (
  settings: BracketLayoutSettings,
  dataLayout: BracketDataLayout,
): CreateBracketGridConfig => ({
  includeRoundHeaders: !settings.hideRoundHeaders,
  columnGap: settings.columnGap,
  rowRoundGap: settings.rowRoundGap,
  columnWidth: settings.columnWidth,
  matchHeight: settings.matchHeight,
  roundHeaderHeight: settings.hideRoundHeaders ? 0 : settings.roundHeaderHeight,
  rowGap: settings.rowGap,
  rowSpanRoundId: settings.rowSpanRoundId,
  layout: dataLayout,
  finalMatchHeight: settings.finalMatchHeight,
  finalColumnWidth: settings.finalColumnWidth,
  roundHeaderGap: settings.hideRoundHeaders ? 0 : settings.roundHeaderGap,
  finalRoundHeaderGap: settings.hideRoundHeaders ? null : settings.finalRoundHeaderGap,
  thirdPlaceTopOffset: settings.thirdPlaceTopOffset,
  swissGroupPadding: settings.swissGroupPadding,
  swissGroupBorderWidth: settings.lineWidth,
  continueElement:
    settings.showContinueElement && dataLayout === BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT
      ? {
          columnWidth: settings.continueColumnWidth,
          elementHeight: settings.continueElementHeight,
        }
      : null,
});
