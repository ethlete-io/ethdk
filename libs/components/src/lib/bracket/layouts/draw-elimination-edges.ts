import { BracketDrawEdgesContext } from '../bracket-layout';
import { drawMan } from '../drawing/draw-man';

/**
 * The connector drawing every elimination layout shares — single and double, folded or not — mapping
 * the host's resolved settings onto {@link drawMan}'s dimensions.
 *
 * @internal
 */
export const drawEliminationEdges = <TRoundData, TMatchData>(
  context: BracketDrawEdgesContext<TRoundData, TMatchData>,
) => {
  const { grid, settings } = context;

  return drawMan({
    columnGap: settings.columnGap,
    upperLowerGap: settings.rowRoundGap,
    columnWidth: settings.columnWidth,
    matchHeight: settings.matchHeight,
    roundHeaderHeight: settings.hideRoundHeaders ? 0 : settings.roundHeaderHeight,
    rowGap: settings.rowGap,
    bracketGrid: grid,
    curve: {
      lineEndingCurveAmount: settings.lineEndingCurveAmount,
      lineStartingCurveAmount: settings.lineStartingCurveAmount,
    },
    path: {
      dashArray: settings.lineDashArray,
      dashOffset: settings.lineDashOffset,
      width: settings.lineWidth,
    },
    continuePath: {
      dashArray: settings.continueLineDashArray,
      dashOffset: settings.lineDashOffset,
      width: settings.lineWidth,
    },
  });
};
