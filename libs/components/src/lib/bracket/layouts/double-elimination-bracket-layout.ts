import { BracketLayout, BracketListSection } from '../bracket-layout';
import { BracketLabels } from '../bracket-labels';
import { BRACKET_DATA_LAYOUT } from '../core/layout';
import { COMMON_BRACKET_ROUND_TYPE, DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE } from '../core/round';
import { TOURNAMENT_MODE } from '../core/tournament';
import { createDoubleEliminationGrid } from '../drawing/grid/double-elimination';
import { createStackedDoubleEliminationGrid } from '../drawing/grid/double-elimination-stacked';
import { BracketRound } from '../linked/bracket';
import { drawEliminationEdges } from './draw-elimination-edges';

/**
 * Where a double elimination round sits in `<et-bracket-rounds-list>`: the winners bracket, the losers
 * bracket, or the deciding rounds.
 */
const doubleEliminationListSection = <TRoundData, TMatchData>(
  round: BracketRound<TRoundData, TMatchData>,
  labels: BracketLabels,
): BracketListSection => {
  switch (round.type) {
    case DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.UPPER_BRACKET:
      return { id: 'upper', name: labels.upperBracketSection };

    case DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.LOWER_BRACKET:
      return { id: 'lower', name: labels.lowerBracketSection };

    // The grand final, the bracket reset and the third-place playoff - everything a double elimination
    // source has left once the two brackets are accounted for.
    case COMMON_BRACKET_ROUND_TYPE.FINAL:
    case DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.REVERSE_FINAL:
    case COMMON_BRACKET_ROUND_TYPE.THIRD_PLACE:
    default:
      return { id: 'finals', name: labels.finalsSection };
  }
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
  createGrid: createStackedDoubleEliminationGrid,
  drawEdges: drawEliminationEdges,
  // eslint-disable-next-line max-params -- the contract's (round, bracket, labels) shape
  listSection: (round, _bracket, labels) => doubleEliminationListSection(round, labels),
});
