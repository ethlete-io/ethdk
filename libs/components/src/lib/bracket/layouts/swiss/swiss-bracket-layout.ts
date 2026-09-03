import { BracketLayout } from '../../bracket-layout';
import { BRACKET_DATA_LAYOUT } from '../../core/layout';
import { TOURNAMENT_MODE } from '../../core/tournament';
import { BracketMatchComponent, BracketRoundHeaderComponent, createSwissGrid, drawSwissMan } from '@ethlete/bracket';
import { BracketSwissColors, generateBracketRoundSwissGroupMaps } from '../../linked/swiss';
import { BracketSwissStylesComponent } from './bracket-swiss-styles.component';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SwissBracketLayoutOptions<TRoundData = any, TMatchData = any> = {
  /**
   * Colors for the group borders and connection lines - see {@link BracketSwissColors}. A host's
   * `swissColors` input still wins over this, per instance.
   */
  colors?: BracketSwissColors;

  /**
   * Cards drawn for swiss sources only, sitting between a host's inputs and the app-wide
   * `provideBracketConfig` components - a swiss stage often wants a denser card than the
   * elimination stage next to it.
   */
  matchComponent?: BracketMatchComponent<TRoundData, TMatchData>;
  roundHeaderComponent?: BracketRoundHeaderComponent<TRoundData, TMatchData>;
};

/**
 * Draws a swiss stage (with elimination) as standings groups per round - winners climbing, losers
 * sinking, group-to-group connection lines instead of match-to-match. What a `mode` of
 * `'swiss-with-elimination'` renders once this is registered.
 *
 * @example
 * provideBracketConfig({ layouts: [swissBracketLayout()] });
 *
 * @example
 * swissBracketLayout({ colors: { positive: 'var(--my-win-color)' } })
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const swissBracketLayout = <TRoundData = any, TMatchData = any>(
  options: SwissBracketLayoutOptions<TRoundData, TMatchData> = {},
): BracketLayout<TRoundData, TMatchData> => ({
  name: 'swiss-with-elimination',
  mode: TOURNAMENT_MODE.SWISS_WITH_ELIMINATION,
  dataLayout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT,
  createGrid: createSwissGrid,
  drawEdges: (context) =>
    drawSwissMan({
      bracketGrid: context.grid,
      curve: {
        lineStartingCurveAmount: context.settings.lineStartingCurveAmount,
      },
      path: {
        dashArray: context.settings.lineDashArray,
        dashOffset: context.settings.lineDashOffset,
        width: context.settings.lineWidth,
      },
      groupBorder: {
        padding: context.settings.swissGroupPadding,
        radius: context.settings.swissGroupBorderRadius,
        width: context.settings.lineWidth,
      },
      colors: context.colors ?? options.colors,
      idPrefix: context.idPrefix,
    }),
  listGrouping: generateBracketRoundSwissGroupMaps,
  components: {
    match: options.matchComponent,
    roundHeader: options.roundHeaderComponent,
  },
  styles: [BracketSwissStylesComponent],
});
