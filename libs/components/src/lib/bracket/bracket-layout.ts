import { Type } from '@angular/core';
import { BracketComponentOverrides } from './bracket-components';
import { BracketLayoutSettings } from './bracket-grid';
import { BracketLabels } from './bracket-labels';
import { BracketDataLayout } from './core/layout';
import { TournamentMode } from './core/tournament';
import {
  BracketComponents,
  ComputedBracketGrid,
  CreateBracketGridConfig,
  resolveBracketLayout as resolveBracketLayoutCore,
} from '@ethlete/bracket';
import { Bracket, BracketRound } from './linked/bracket';
import { BracketRoundMapWithSwissData, BracketSwissColors } from './linked/swiss';

/**
 * What {@link BracketLayout.drawEdges} gets to work with: the grid it is connecting and the resolved
 * settings of the host that built it.
 */
export type BracketDrawEdgesContext<TRoundData = unknown, TMatchData = unknown> = {
  grid: ComputedBracketGrid<TRoundData, TMatchData>;
  /** Every layout setting in effect on the host, resolved - inputs, config, density preset, defaults. */
  settings: BracketLayoutSettings;
  /** Unique per host instance - prefix any `id` the SVG mints (gradients) so two brackets can coexist. */
  idPrefix: string;
  /** The host's `swissColors` input, when set. Layouts that draw no swiss groups ignore it. */
  colors?: BracketSwissColors;
};

/**
 * A section a round renders under in `<et-bracket-rounds-list>` - the heading is `name`, and rounds
 * whose consecutive sections share an `id` render under one heading.
 */
export type BracketListSection = {
  id: string;
  name: string | null;
};

/**
 * Everything one way of drawing a bracket knows how to do, as a plain value: how to position the
 * matches into a grid and how to draw the lines between them, plus the optional hooks the rounds list
 * and the card resolution ask for.
 *
 * Register the layouts your app renders with `provideBracketConfig({ layouts: [...] })` (or hand them
 * to the `layouts` input) - each one comes from a factory like `singleEliminationBracketLayout()`.
 * **Only the factories you call end up in your bundle**; a source whose `mode` has no registered
 * layout throws `ET3413` rather than rendering wrong.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BracketLayout<TRoundData = any, TMatchData = any> = {
  /** Names the layout in errors and devtools - `'single-elimination-mirrored'`. */
  name: string;

  /**
   * The tournament mode this layout draws; what {@link resolveBracketLayout} keys on. Several layouts
   * may serve the same mode (`doubleEliminationBracketLayout()` and its mirrored variant) - the first
   * match in the registered array wins.
   */
  mode: TournamentMode;

  /**
   * How the engine orders and splits the rounds before this layout ever sees them - `'mirrored'` halves
   * every round that can be halved. An engine detail carried by the layout, not a consumer knob.
   *
   * @internal
   */
  dataLayout: BracketDataLayout;

  /** Positions the linked bracket's rounds and matches into a grid of columns. */
  // eslint-disable-next-line max-params -- grid builder signature (data, options, components)
  createGrid: (
    bracket: Bracket<TRoundData, TMatchData>,
    options: CreateBracketGridConfig,
    components: BracketComponents<TRoundData, TMatchData>,
  ) => ComputedBracketGrid<TRoundData, TMatchData>;

  /** Draws the SVG between the cells - connectors, group borders - as an HTML string. */
  drawEdges: (context: BracketDrawEdgesContext<TRoundData, TMatchData>) => string;

  /**
   * Splits rounds into standings groups for `<et-bracket-rounds-list>` - a swiss round lists each
   * win/loss group under its own header. Layouts without groups leave this unset.
   */
  listGrouping?: (
    bracket: Bracket<TRoundData, TMatchData>,
  ) => BracketRoundMapWithSwissData<TRoundData, TMatchData> | null;

  /**
   * Sections a round under a heading in `<et-bracket-rounds-list>` - double elimination separates
   * upper bracket, lower bracket and finals. Unset renders every round under no heading.
   */
  // eslint-disable-next-line max-params -- (round, bracket, labels) mirrors the list's question
  listSection?: (
    round: BracketRound<TRoundData, TMatchData>,
    bracket: Bracket<TRoundData, TMatchData>,
    labels: BracketLabels,
  ) => BracketListSection;

  /**
   * Per-layout default cards, sitting between the host's inputs and the app config: input →
   * these → `provideBracketConfig` components → shipped defaults.
   */
  components?: BracketComponentOverrides<TRoundData, TMatchData>;

  /**
   * Styles-only components the host mounts (once, app-wide) while this layout renders - CSS only
   * brackets with this layout need, kept out of every other consumer's document.
   */
  styles?: readonly Type<unknown>[];
};

/**
 * The layout drawing a source: the first registered layout whose `mode` matches. Throws `ET3413` when
 * none does - a bracket never silently renders a mode it was not given the code for.
 *
 * @internal
 */
export const resolveBracketLayout = <TRoundData, TMatchData>(
  layouts: readonly BracketLayout<TRoundData, TMatchData>[] | undefined,
  mode: TournamentMode,
): BracketLayout<TRoundData, TMatchData> => {
  return resolveBracketLayoutCore(layouts, mode);
};
