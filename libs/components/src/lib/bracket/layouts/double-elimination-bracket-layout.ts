import { BracketLayout, BracketListSection } from '../bracket-layout';
import { BracketLabels, bracketSectionLabel } from '../bracket-labels';
import {
  BRACKET_DATA_LAYOUT,
  TOURNAMENT_MODE,
  createDoubleEliminationGrid,
  ɵcreateStackedDoubleEliminationGrid,
  BracketRound,
  doubleEliminationRoundSection,
} from '@ethlete/bracket';
import { drawEliminationEdges } from './draw-elimination-edges';

const doubleEliminationListSection = <TRoundData, TMatchData>(
  round: BracketRound<TRoundData, TMatchData>,
  labels: BracketLabels,
): BracketListSection => {
  const id = doubleEliminationRoundSection(round);

  return { id, name: bracketSectionLabel(id, labels) };
};

/**
 * Draws a double elimination source left to right - upper bracket over lower bracket, converging on the
 * grand final (and the bracket reset, when the source has one). What a `mode` of `'double-elimination'`
 * renders once this is registered.
 *
 * @example
 * provideBracketConfig({ layouts: [doubleEliminationBracketLayout()] });
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const doubleEliminationBracketLayout = <TRoundData = any, TMatchData = any>(): BracketLayout<
  TRoundData,
  TMatchData
> => ({
  name: 'double-elimination',
  mode: TOURNAMENT_MODE.DOUBLE_ELIMINATION,
  dataLayout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT,
  createGrid: createDoubleEliminationGrid,
  drawEdges: drawEliminationEdges,
  // eslint-disable-next-line max-params -- the contract's (round, bracket, labels) shape
  listSection: (round, _bracket, labels) => doubleEliminationListSection(round, labels),
});

/**
 * The mirrored variant of {@link doubleEliminationBracketLayout}: two stacked blocks, the winners
 * bracket above the losers bracket, each folded around its own centre. A block's deciding rounds - the
 * grand final and the bracket reset above, the third-place playoff below - hang vertically under the
 * round its two halves converge on.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const mirroredDoubleEliminationBracketLayout = <TRoundData = any, TMatchData = any>(): BracketLayout<
  TRoundData,
  TMatchData
> => ({
  name: 'double-elimination-mirrored',
  mode: TOURNAMENT_MODE.DOUBLE_ELIMINATION,
  dataLayout: BRACKET_DATA_LAYOUT.MIRRORED,
  createGrid: ɵcreateStackedDoubleEliminationGrid,
  drawEdges: drawEliminationEdges,
  // eslint-disable-next-line max-params -- the contract's (round, bracket, labels) shape
  listSection: (round, _bracket, labels) => doubleEliminationListSection(round, labels),
});
