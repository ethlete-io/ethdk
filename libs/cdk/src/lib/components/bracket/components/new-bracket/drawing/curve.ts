import { BracketPosition } from './math';
import { path, PathOptions } from './path';

export type CurveOptions = {
  lineStartingCurveAmount: number;
  lineEndingCurveAmount: number;
  path: PathOptions;
  inverted?: boolean;
};

export const curvePath = (
  from: BracketPosition,
  to: BracketPosition,
  direction: 'up' | 'down',
  options: CurveOptions,
) => {
  const inverted = options.inverted ?? false;

  // Inline/block coordinates depending on direction and inversion
  const fromInline = inverted ? from.inline.start : from.inline.end;
  const toInline = inverted ? to.inline.end : to.inline.start;
  const fromBlock = from.block.center;
  const toBlock = to.block.center;

  // Curve parameters
  const startCurve = options.lineStartingCurveAmount;
  const endCurve = options.lineEndingCurveAmount;
  const totalInline = Math.abs(toInline - fromInline);
  const straightLength = (totalInline - startCurve - endCurve) / 2;

  // Calculate key points for the path
  const straightEnd = inverted ? fromInline - straightLength : fromInline + straightLength;
  const straightStart = inverted ? toInline + straightLength : toInline - straightLength;

  // First curve (from start)
  const firstCurveEndX = inverted ? straightEnd - startCurve : straightEnd + startCurve;
  const firstCurveEndY = direction === 'down' ? fromBlock + startCurve : fromBlock - startCurve;

  // Second curve (to end)
  const secondCurveStartY = direction === 'down' ? toBlock - endCurve : toBlock + endCurve;
  const secondCurveEndX = straightStart;
  const secondCurveEndY = toBlock;
  const secondCurveBezierX = inverted ? straightStart + endCurve : straightStart - endCurve;

  // SVG path string
  const d = [
    `M ${fromInline} ${fromBlock}`,
    `H ${straightEnd}`,
    `Q ${firstCurveEndX} ${fromBlock}, ${firstCurveEndX} ${firstCurveEndY}`,
    `V ${secondCurveStartY}`,
    `Q ${secondCurveBezierX} ${toBlock}, ${secondCurveEndX} ${secondCurveEndY}`,
    `H ${toInline}`,
  ].join(' ');

  return path(d, options.path);
};
