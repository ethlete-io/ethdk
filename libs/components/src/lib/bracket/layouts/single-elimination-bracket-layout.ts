import { BracketLayout } from '../bracket-layout';
import { BRACKET_DATA_LAYOUT } from '../core/layout';
import { TOURNAMENT_MODE } from '../core/tournament';
import { createSingleEliminationGrid } from '../drawing/grid/single-elimination';
import { drawEliminationEdges } from './draw-elimination-edges';

/**
 * Draws a single elimination source left to right, converging on the final — what a `mode` of
 * `'single-elimination'` renders once this is registered.
 *
 * @example
 * provideBracketConfig({ layouts: [singleEliminationBracketLayout()] });
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const singleEliminationBracketLayout = <TRoundData = any, TMatchData = any>(): BracketLayout<
  TRoundData,
  TMatchData
> => ({
  name: 'single-elimination',
  mode: TOURNAMENT_MODE.SINGLE_ELIMINATION,
  dataLayout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT,
  createGrid: createSingleEliminationGrid,
  drawEdges: drawEliminationEdges,
});

/**
 * The mirrored variant of {@link singleEliminationBracketLayout}: the bracket folds in half, each round
 * that can be halved drawn once on each side, converging on the final in the middle — half the height,
 * roughly double the width, the shape a poster or a broadcast graphic wants.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const mirroredSingleEliminationBracketLayout = <TRoundData = any, TMatchData = any>(): BracketLayout<
  TRoundData,
  TMatchData
> => ({
  name: 'single-elimination-mirrored',
  mode: TOURNAMENT_MODE.SINGLE_ELIMINATION,
  dataLayout: BRACKET_DATA_LAYOUT.MIRRORED,
  createGrid: createSingleEliminationGrid,
  drawEdges: drawEliminationEdges,
});
