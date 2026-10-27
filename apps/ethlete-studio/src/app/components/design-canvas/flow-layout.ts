import { Point, Rect } from './canvas-math';

export type FlowLink = { from: string; to: string };

/** A line of a `flow` canvas from one frame id to another. */
export type CanvasLine = FlowLink & { label?: string };

export type FlowBox = { id: string; width: number; height: number; at?: Point };

export type FlowSpacing = { columnGap: number; rowGap: number; maxColumnGap: number };

const ARC_RISE = 96;
const LABEL_CHAR_WIDTH = 7;
const LABEL_CHROME = 18;
const LABEL_MARGIN = 40;

/** The widest a line label gets in a gap of `maxColumnGap`; a longer label wraps. */
export const flowLabelMaxWidthOf = ({ maxColumnGap }: FlowSpacing) => maxColumnGap - 2 * LABEL_MARGIN;

/** The gap a label needs between two columns: the normal gap, or wider to fit it, up to `maxColumnGap`. */
export const flowGapOf = (label: string | undefined, spacing: FlowSpacing) => {
  const width = label ? label.length * LABEL_CHAR_WIDTH + LABEL_CHROME + 2 * LABEL_MARGIN : 0;

  return Math.min(spacing.maxColumnGap, Math.max(spacing.columnGap, width));
};

/**
 * The column of each frame along the links, left to right: a frame sits one column after the
 * furthest frame that links to it. A link that closes a cycle, and a link of a frame to itself,
 * moves nothing.
 */
export const flowColumnsOf = (ids: string[], links: FlowLink[]): Map<string, number> => {
  const known = new Set(ids);
  const outgoing = new Map(ids.map((id) => [id, [] as string[]]));

  for (const { from, to } of links) if (known.has(from) && known.has(to) && from !== to) outgoing.get(from)?.push(to);

  const forward: FlowLink[] = [];
  const state = new Map<string, 'open' | 'done'>();
  const visit = (id: string) => {
    state.set(id, 'open');

    for (const to of outgoing.get(id) ?? []) {
      if (state.get(to) === 'open') continue;

      forward.push({ from: id, to });

      if (!state.has(to)) visit(to);
    }

    state.set(id, 'done');
  };

  ids.forEach((id) => state.has(id) || visit(id));

  const columns = new Map<string, number>();
  const columnOf = (id: string): number => {
    const known = columns.get(id);

    if (known !== undefined) return known;

    const column = Math.max(0, ...forward.filter((link) => link.to === id).map((link) => columnOf(link.from) + 1));

    columns.set(id, column);

    return column;
  };

  ids.forEach(columnOf);

  return columns;
};

/**
 * Each frame at its `at`, or in its column of `flowColumnsOf`, under the frames before it in that column. The gap
 * after a column grows with the longest label of a line into the next column.
 */
export const layoutFlow = (
  boxes: FlowBox[],
  { links, spacing }: { links: CanvasLine[]; spacing: FlowSpacing },
): (Rect & { id: string })[] => {
  const columns = flowColumnsOf(
    boxes.map((box) => box.id),
    links,
  );
  const laid = boxes.filter((box) => !box.at);
  const used = [...new Set(laid.map((box) => columns.get(box.id) ?? 0))].sort((a, b) => a - b);
  const widths = used.map((column) =>
    Math.max(...laid.filter((box) => columns.get(box.id) === column).map((box) => box.width)),
  );
  const columnOfLaid = new Map(laid.map((box) => [box.id, columns.get(box.id) ?? 0]));
  const gapAfter = (index: number) =>
    Math.max(
      spacing.columnGap,
      ...links
        .filter((link) => columnOfLaid.get(link.from) === used[index] && columnOfLaid.get(link.to) === used[index + 1])
        .map((link) => flowGapOf(link.label, spacing)),
    );
  const lefts = new Map<number, number>();
  let left = 0;

  for (const [index, column] of used.entries()) {
    lefts.set(column, left);
    left += (widths[index] ?? 0) + gapAfter(index);
  }
  const tops = new Map<number, number>();

  return boxes.map(({ id, width, height, at }) => {
    if (at) return { id, x: at.x, y: at.y, width, height };

    const column = columns.get(id) ?? 0;
    const y = tops.get(column) ?? 0;

    tops.set(column, y + height + spacing.rowGap);

    return { id, x: lefts.get(column) ?? 0, y, width, height };
  });
};

const bezierPoint = ([p0, p1, p2, p3]: [Point, Point, Point, Point]): Point => ({
  x: (p0.x + 3 * p1.x + 3 * p2.x + p3.x) / 8,
  y: (p0.y + 3 * p1.y + 3 * p2.y + p3.y) / 8,
});

const pathOf = ([p0, p1, p2, p3]: [Point, Point, Point, Point]) =>
  `M ${p0.x} ${p0.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${p3.x} ${p3.y}`;

/**
 * The curve of a line from one frame to another: from the right edge into the left edge when the
 * target lies to the right, else in an arc over both tops. `middle` is where its label sits.
 */
export const flowCurveOf = (from: Rect, to: Rect): { path: string; middle: Point } => {
  if (to.x >= from.x + from.width) {
    const start = { x: from.x + from.width, y: from.y + from.height / 2 };
    const end = { x: to.x, y: to.y + to.height / 2 };
    const pull = (end.x - start.x) / 2;
    const points: [Point, Point, Point, Point] = [
      start,
      { x: start.x + pull, y: start.y },
      { x: end.x - pull, y: end.y },
      end,
    ];

    return { path: pathOf(points), middle: bezierPoint(points) };
  }

  const start = { x: from.x + from.width / 2, y: from.y };
  const end = { x: to.x + to.width / 2, y: to.y };
  const top = Math.min(start.y, end.y) - ARC_RISE - Math.abs(end.x - start.x) / 8;
  const points: [Point, Point, Point, Point] = [start, { x: start.x, y: top }, { x: end.x, y: top }, end];

  return { path: pathOf(points), middle: bezierPoint(points) };
};
