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
  // eslint-disable-next-line max-params -- geometry helper: (from, to, direction, options) reads naturally positional
) => {
  const inverted = options.inverted ?? false;

  // Inline/block coordinates depending on direction and inversion
  const fromInline = inverted ? from.inline.start : from.inline.end;
  const toInline = inverted ? to.inline.end : to.inline.start;
  const fromBlock = from.block.center;
  const toBlock = to.block.center;

  // Both bends have to fit inside the block distance between the two cards, or the line turns past its
  // target and comes back. Scaling them down instead - to nothing, for two cards on the same row - is
  // also what keeps the six commands below identical for every connector: a CSS `d` transition
  // interpolates only between two paths of the same shape.
  const requestedCurve = options.lineStartingCurveAmount + options.lineEndingCurveAmount;
  const blockDistance = Math.abs(toBlock - fromBlock);
  const curveScale = requestedCurve > blockDistance ? blockDistance / requestedCurve : 1;

  const startCurve = options.lineStartingCurveAmount * curveScale;
  const endCurve = options.lineEndingCurveAmount * curveScale;
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
