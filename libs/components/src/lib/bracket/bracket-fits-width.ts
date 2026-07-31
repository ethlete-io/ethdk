import { BracketDataSource } from './integrations';
import { createBracket } from './linked/bracket';
import { resolveBracketComponents } from './bracket-components';
import { createBracketGridConfig, resolveBracketLayoutSettings } from './bracket-grid';
import { resolveBracketLayout } from './bracket-layout';
import { BracketConfig } from './bracket.config';

/**
 * How wide `<et-bracket>` would draw this source, in px — the width it needs before it starts
 * scrolling sideways.
 *
 * It answers the question by laying the bracket out for real rather than estimating from the round
 * count, because a double-elimination grid's width is not a multiple of anything: a wider final column,
 * a continue column, and front-padded rounds all move it.
 *
 * Cheap enough to call from a `computed()` over the source, and no more expensive than the render it
 * predicts — but it is not free, so key it on the source rather than on the observed width.
 *
 * @param source The same source you would pass to `<et-bracket>`.
 * @param config The settings the bracket will run with — the object you pass to
 *   `provideBracketConfig`, or the subset you bind as inputs, **including its `layouts`** (the width
 *   of a bracket is the layout's answer). Anything else left out uses `BRACKET_DEFAULTS`.
 *
 * @example
 * const naturalWidth = bracketNaturalWidth(source, {
 *   layouts: [singleEliminationBracketLayout()],
 *   columnWidth: 200,
 * });
 */
export const bracketNaturalWidth = <TRoundData, TMatchData>(
  source: BracketDataSource<TRoundData, TMatchData>,
  config: BracketConfig<TRoundData, TMatchData> = {},
) => {
  const layout = resolveBracketLayout(config.layouts, source.mode);
  const settings = resolveBracketLayoutSettings(config);
  const bracketData = createBracket(source, { layout: layout.dataLayout });
  const components = resolveBracketComponents({}, config, layout.components);
  const grid = layout.createGrid(bracketData, createBracketGridConfig(settings, layout.dataLayout), components);

  return grid.raw.grid.dimensions.width;
};

/**
 * Whether the bracket fits into `availableWidth` px without scrolling — the decision behind swapping
 * `<et-bracket>` for [`<et-bracket-rounds-list>`](/components/bracket#responsive-switching) on a narrow
 * screen.
 *
 * Measure a container that does **not** grow with its content (a scroll container's parent, not the
 * scroll container), or the answer is always yes.
 *
 * @example
 * // in a component that hosts one representation or the other
 * private dimensions = signalHostElementDimensions();
 *
 * protected fitsBracket = computed(() =>
 *   bracketFitsWidth(this.source(), BRACKET_CONFIG, this.dimensions().client?.width ?? 0),
 * );
 */
export const bracketFitsWidth = <TRoundData, TMatchData>(
  source: BracketDataSource<TRoundData, TMatchData>,
  config: BracketConfig<TRoundData, TMatchData>,
  availableWidth: number,
  // eslint-disable-next-line max-params -- (source, config, width) reads as the question it answers
) => bracketNaturalWidth(source, config) <= availableWidth;
