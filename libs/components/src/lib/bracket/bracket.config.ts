import { defineStaticRootProvider, toInjectFn, toProvideFn } from '@ethlete/core';
import { BracketMatchNormalizer } from './bracket-card-context';
import { BracketDensity } from './bracket-density';
import { BracketLayout } from './bracket-layout';
import { BracketContinueComponent, BracketMatchComponent, BracketRoundHeaderComponent } from '@ethlete/bracket';

export const BRACKET_ROUND_HEADER_ALIGN = {
  START: 'start',
  CENTER: 'center',
} as const;

export type BracketRoundHeaderAlign = (typeof BRACKET_ROUND_HEADER_ALIGN)[keyof typeof BRACKET_ROUND_HEADER_ALIGN];

/**
 * Default values for the et-bracket component inputs. Inputs set on the component
 * always win over the config.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BracketConfig<TRoundData = any, TMatchData = any> = {
  /**
   * The ways of drawing a bracket this app ships, one per tournament mode - see {@link BracketLayout}.
   * Only the factories you call here end up in your bundle; a source whose mode has no entry throws
   * `ET3413`. A host's `layouts` input replaces this list entirely for that instance.
   *
   * @example
   * provideBracketConfig({ layouts: [singleEliminationBracketLayout(), swissBracketLayout()] });
   */
  layouts?: readonly BracketLayout<TRoundData, TMatchData>[];

  columnWidth?: number;
  matchHeight?: number;
  finalMatchHeight?: number;
  finalColumnWidth?: number;
  roundHeaderHeight?: number;
  roundHeaderGap?: number;
  columnGap?: number;
  rowGap?: number;
  rowRoundGap?: number;
  /** The round whose density determines vertical spacing. `null` uses the opening round. */
  rowSpanRoundId?: string | null;
  /**
   * How far below the top of the final's card a third place match sits, in px, folding it into the
   * final's column and moving its round header above its own card. `null` gives it a column of its own.
   *
   * Only a single elimination layout has a column to fold: a double elimination grid already hangs the
   * third place under its final.
   */
  thirdPlaceTopOffset?: number | null;
  /**
   * What the final keeps between its round header and its card, in px, where that is more than
   * `roundHeaderGap` - room for a trophy line or a stage label. `null` gives it the same gap as every
   * other round.
   *
   * The room goes to the final's column alone; widening `roundHeaderGap` instead lowers the card of
   * every round.
   */
  finalRoundHeaderGap?: number | null;
  /**
   * Where a round header sits over its column. `'center'` is the one round of a narrow panel, where the
   * header names the panel rather than labelling a column it starts.
   *
   * A header that fills its column - the shipped one does - looks the same either way.
   */
  alignRoundHeaders?: BracketRoundHeaderAlign;
  /**
   * How much room to keep to the inline start of `focusRoundId`, in px - the gutter a one-round panel
   * puts its navigation in, and that a card badge may straddle the card's edge into.
   */
  focusInset?: number;
  lineStartingCurveAmount?: number;
  lineEndingCurveAmount?: number;
  lineWidth?: number;
  lineDashArray?: number;
  lineDashOffset?: number;
  disableJourneyHighlight?: boolean;
  swissGroupPadding?: number;
  swissGroupBorderRadius?: number;
  /**
   * The size everything is drawn at - `'default'`, or `'compact'` for a bracket in an article column or
   * a phone. A preset under everything else: any setting above still wins over it. See
   * {@link BRACKET_DENSITY_PRESETS}.
   */
  density?: BracketDensity;
  hideRoundHeaders?: boolean;
  showContinueElement?: boolean;
  continueColumnWidth?: number;
  continueElementHeight?: number;
  continueLineDashArray?: number;

  roundHeaderComponent?: BracketRoundHeaderComponent<TRoundData, TMatchData>;
  matchComponent?: BracketMatchComponent<TRoundData, TMatchData>;
  finalMatchComponent?: BracketMatchComponent<TRoundData, TMatchData>;
  continueComponent?: BracketContinueComponent<TRoundData, TMatchData>;

  /**
   * How to read your match data - required by the **default** cards, ignored by cards of your own. See
   * {@link BracketMatchNormalizer}; the Ethlete integration ships a ready-made one.
   */
  matchNormalizer?: BracketMatchNormalizer<TRoundData, TMatchData>;
  /**
   * The `aria-level` the default round headers announce themselves at. Match it to where the bracket
   * sits in your page's heading outline - a bracket under an `<h2>` section wants `3`.
   */
  roundHeaderLevel?: number;
};

/**
 * The settings that describe how a bracket is *drawn*, as opposed to what draws it - everything in
 * {@link BracketConfig} except the layouts, the component slots and the normalizer.
 */
export type BracketLayoutConfig = Omit<
  BracketConfig,
  | 'layouts'
  | 'roundHeaderComponent'
  | 'matchComponent'
  | 'finalMatchComponent'
  | 'continueComponent'
  | 'matchNormalizer'
>;

/**
 * The value every {@link BracketLayoutConfig} setting falls back to when neither an input, a density
 * preset nor `provideBracketConfig` supplies one.
 *
 * It exists so the component and the standalone helpers that have to predict its layout
 * ({@link bracketNaturalWidth}) can never drift apart - the type makes leaving a new setting out a
 * compile error.
 */
export const BRACKET_DEFAULTS: Required<BracketLayoutConfig> = {
  columnWidth: 250,
  matchHeight: 75,
  // Sized for the shipped final card, which is a header, an expanded match card and a champion line
  // stacked - the previous 300×75 fitted the debug placeholder and nothing else. A custom final card that
  // wants the old box sets these back.
  finalMatchHeight: 200,
  finalColumnWidth: 360,
  roundHeaderHeight: 50,
  roundHeaderGap: 20,
  columnGap: 60,
  rowGap: 30,
  rowRoundGap: 20,
  rowSpanRoundId: null,
  thirdPlaceTopOffset: null,
  finalRoundHeaderGap: null,
  alignRoundHeaders: BRACKET_ROUND_HEADER_ALIGN.START,
  focusInset: 0,
  lineStartingCurveAmount: 10,
  lineEndingCurveAmount: 0,
  lineWidth: 2,
  lineDashArray: 0,
  lineDashOffset: 0,
  disableJourneyHighlight: false,
  swissGroupPadding: 10,
  swissGroupBorderRadius: 12,
  density: 'default',
  hideRoundHeaders: false,
  showContinueElement: false,
  continueColumnWidth: 250,
  continueElementHeight: 75,
  continueLineDashArray: 6,
  roundHeaderLevel: 3,
};

const BRACKET_CONFIG_DEF = /* @__PURE__ */ defineStaticRootProvider<BracketConfig>({}, { name: 'BracketConfig' });

export const provideBracketConfig = /* @__PURE__ */ toProvideFn(BRACKET_CONFIG_DEF);
export const injectBracketConfig = /* @__PURE__ */ toInjectFn(BRACKET_CONFIG_DEF);
