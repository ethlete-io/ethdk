type Box = { left: number; top: number; width: number; height: number };

const GAP = 4;
const HEAD_LENGTH = 10;
const HEAD_HALF = 5;

const reachOf = (box: Box, unit: { x: number; y: number }) =>
  Math.min(
    unit.x === 0 ? Infinity : box.width / 2 / Math.abs(unit.x),
    unit.y === 0 ? Infinity : box.height / 2 / Math.abs(unit.y),
  );

/**
 * The arrow from the old place of a moved part to its new place, from edge to edge of the two marks: the line and the
 * points of its head. `null` while the marks overlap so far that no line fits between them.
 */
export const moveArrowOf = (from: Box, to: Box) => {
  const start = { x: from.left + from.width / 2, y: from.top + from.height / 2 };
  const end = { x: to.left + to.width / 2, y: to.top + to.height / 2 };
  const length = Math.hypot(end.x - start.x, end.y - start.y);

  if (length === 0) return null;

  const unit = { x: (end.x - start.x) / length, y: (end.y - start.y) / length };
  const out = reachOf(from, unit) + GAP;
  const into = length - reachOf(to, unit) - GAP;

  if (into - out < HEAD_LENGTH * 2) return null;

  const tip = { x: start.x + unit.x * into, y: start.y + unit.y * into };
  const base = { x: tip.x - unit.x * HEAD_LENGTH, y: tip.y - unit.y * HEAD_LENGTH };
  const side = { x: -unit.y * HEAD_HALF, y: unit.x * HEAD_HALF };
  const point = ({ x, y }: { x: number; y: number }) => `${x.toFixed(1)},${y.toFixed(1)}`;

  return {
    x1: start.x + unit.x * out,
    y1: start.y + unit.y * out,
    x2: base.x,
    y2: base.y,
    head: [tip, { x: base.x + side.x, y: base.y + side.y }, { x: base.x - side.x, y: base.y - side.y }]
      .map(point)
      .join(' '),
  };
};
