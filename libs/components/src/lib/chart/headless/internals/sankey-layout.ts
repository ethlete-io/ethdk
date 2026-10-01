import { RuntimeError } from '@ethlete/core';
import { SANKEY_CHART_ERROR_CODES } from '../../sankey-chart-errors';

export type SankeyLayoutNodeInput = {
  id: string;
};

export type SankeyLayoutLinkInput = {
  source: string;
  target: string;
  value: number;
};

/** `horizontal` runs the flow left to right in columns, `vertical` top to bottom in rows. */
export type SankeyLayoutDirection = 'horizontal' | 'vertical';

export type SankeyLayoutOptions = {
  width: number;
  height: number;
  nodeWidth: number;
  nodeGap: number;
  insetStart: number;
  /** Room before the first and after the last column, along the flow. */
  insetEnd: number;
  /** @default 'horizontal' */
  direction?: SankeyLayoutDirection;
  iterations?: number;
};

export type SankeyLayoutInput = SankeyLayoutOptions & {
  nodes: readonly SankeyLayoutNodeInput[];
  links: readonly SankeyLayoutLinkInput[];
};

export type SankeyLayoutNode = {
  index: number;
  id: string;
  column: number;
  order: number;
  x: number;
  y: number;
  width: number;
  height: number;
  incoming: number;
  outgoing: number;
  value: number;
};

export type SankeyLayoutLink = {
  index: number;
  source: number;
  target: number;
  value: number;
  width: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  path: string;
};

export type SankeyLayout = {
  nodes: SankeyLayoutNode[];
  /** Only the links with a positive value. */
  links: SankeyLayoutLink[];
  direction: SankeyLayoutDirection;
  columnCount: number;
  /** The distance along the flow between the starts of two neighbouring columns. */
  columnStep: number;
  pixelsPerValue: number;
  gap: number;
};

type Edge = { index: number; source: number; target: number; value: number };

const DEFAULT_ITERATIONS = 6;
const MAX_GAP_SHARE = 0.5;

export const EMPTY_SANKEY_LAYOUT: SankeyLayout = {
  nodes: [],
  links: [],
  direction: 'horizontal',
  columnCount: 0,
  columnStep: 0,
  pixelsPerValue: 0,
  gap: 0,
};

/** `null` when the links form a cycle. */
export const assignSankeyColumns = (nodeCount: number, edges: readonly Omit<Edge, 'index'>[]): number[] | null => {
  const columns = new Array<number>(nodeCount).fill(0);
  const pending = new Array<number>(nodeCount).fill(0);
  const outgoing: number[][] = Array.from({ length: nodeCount }, () => []);

  for (const edge of edges) {
    pending[edge.target] = (pending[edge.target] ?? 0) + 1;
    outgoing[edge.source]?.push(edge.target);
  }

  const queue = columns.map((_, index) => index).filter((index) => pending[index] === 0);
  let visited = 0;

  while (queue.length) {
    const node = queue.shift() as number;

    visited++;

    for (const target of outgoing[node] ?? []) {
      columns[target] = Math.max(columns[target] ?? 0, (columns[node] ?? 0) + 1);
      pending[target] = (pending[target] ?? 0) - 1;

      if (pending[target] === 0) queue.push(target);
    }
  }

  return visited === nodeCount ? columns : null;
};

export const countSankeyCrossings = (
  nodes: readonly Pick<SankeyLayoutNode, 'column' | 'order'>[],
  links: readonly Pick<SankeyLayoutLink, 'source' | 'target'>[],
) => {
  let crossings = 0;

  for (let i = 0; i < links.length; i++) {
    for (let j = i + 1; j < links.length; j++) {
      const a = links[i] as Pick<SankeyLayoutLink, 'source' | 'target'>;
      const b = links[j] as Pick<SankeyLayoutLink, 'source' | 'target'>;
      const aSource = nodes[a.source];
      const bSource = nodes[b.source];
      const aTarget = nodes[a.target];
      const bTarget = nodes[b.target];

      if (!aSource || !bSource || !aTarget || !bTarget) continue;
      if (aSource.column !== bSource.column || aTarget.column !== bTarget.column) continue;
      if (a.source === b.source || a.target === b.target) continue;

      if ((aSource.order - bSource.order) * (aTarget.order - bTarget.order) < 0) crossings++;
    }
  }

  return crossings;
};

const readEdges = (nodes: readonly SankeyLayoutNodeInput[], links: readonly SankeyLayoutLinkInput[]) => {
  const indexById = new Map<string, number>();
  let error: RuntimeError<number> | null = null;

  nodes.forEach((node, index) => {
    if (indexById.has(node.id)) {
      if (ngDevMode) {
        error ??= new RuntimeError(
          SANKEY_CHART_ERROR_CODES.DUPLICATE_NODE,
          `[SankeyChartDirective] Two nodes share the id "${node.id}". Give every node its own id.`,
        );
      }

      return;
    }

    indexById.set(node.id, index);
  });

  const edges: Edge[] = [];

  links.forEach((link, index) => {
    const source = indexById.get(link.source);
    const target = indexById.get(link.target);

    if (source === undefined || target === undefined) {
      if (ngDevMode) {
        const missing = source === undefined ? link.source : link.target;

        error ??= new RuntimeError(
          SANKEY_CHART_ERROR_CODES.UNKNOWN_NODE,
          `[SankeyChartDirective] A link points at the node "${missing}", which is not in nodes.`,
        );
      }

      return;
    }

    const valid = Number.isFinite(link.value) && link.value >= 0;

    if (!valid && ngDevMode) {
      error ??= new RuntimeError(
        SANKEY_CHART_ERROR_CODES.INVALID_VALUE,
        `[SankeyChartDirective] The link "${link.source}" -> "${link.target}" has the value ${link.value}. ` +
          'Link values must be finite and not negative.',
      );
    }

    if (valid && link.value > 0) edges.push({ index, source, target, value: link.value });
  });

  return { indexById, edges, error };
};

type ColumnPlacement = {
  columns: number[][];
  heights: number[];
  gap: number;
  height: number;
};

const placeColumns = ({ columns, heights, gap, height }: ColumnPlacement) => {
  const y = new Array<number>(heights.length).fill(0);

  for (const column of columns) {
    const total = column.reduce((sum, node) => sum + (heights[node] ?? 0), 0) + Math.max(0, column.length - 1) * gap;
    let cursor = (height - total) / 2;

    for (const node of column) {
      y[node] = cursor;
      cursor += (heights[node] ?? 0) + gap;
    }
  }

  return y;
};

type CrossingInput = { columns: number[][]; columnOf: number[]; edges: readonly Edge[] };

const crossingsOf = ({ columns, columnOf, edges }: CrossingInput) => {
  const order = new Array<number>(columnOf.length).fill(0);

  columns.forEach((column) => column.forEach((node, position) => (order[node] = position)));

  return countSankeyCrossings(
    columnOf.map((column, index) => ({ column, order: order[index] ?? 0 })),
    edges,
  );
};

type BarycenterInput = {
  column: number[];
  centers: number[];
  neighbours: (node: number) => Edge[];
  far: 'source' | 'target';
};

const sortByBarycenter = ({ column, centers, neighbours, far }: BarycenterInput) => {
  const keyed = column.map((node, position) => {
    let weight = 0;
    let sum = 0;

    for (const edge of neighbours(node)) {
      weight += edge.value;
      sum += edge.value * (centers[edge[far]] ?? 0);
    }

    return { node, position, key: weight > 0 ? sum / weight : (centers[node] ?? 0) };
  });

  keyed.sort((a, b) => a.key - b.key || a.position - b.position);

  return keyed.map((entry) => entry.node);
};

type Ribbon = { along0: number; along1: number; across0: number; across1: number; width: number };

const ribbonPath = ({ along0, along1, across0, across1, width }: Ribbon, direction: SankeyLayoutDirection) => {
  const mid = (along0 + along1) / 2;
  const at = (along: number, across: number) =>
    direction === 'vertical' ? `${across},${along}` : `${along},${across}`;

  return (
    `M${at(along0, across0)}C${at(mid, across0)} ${at(mid, across1)} ${at(along1, across1)}` +
    `L${at(along1, across1 + width)}C${at(mid, across1 + width)} ${at(mid, across0 + width)} ${at(along0, across0 + width)}Z`
  );
};

/**
 * The first problem with the data - a duplicate node, a link to an unknown node, an invalid value or a
 * cycle - or `null`. Dev mode only; always `null` in production.
 */
export const findSankeyDataError = (
  nodes: readonly SankeyLayoutNodeInput[],
  links: readonly SankeyLayoutLinkInput[],
): RuntimeError<number> | null => {
  if (!ngDevMode) return null;

  const { edges, error } = readEdges(nodes, links);

  if (error) return error;

  if (nodes.length && !assignSankeyColumns(nodes.length, edges)) {
    return new RuntimeError(
      SANKEY_CHART_ERROR_CODES.CYCLE,
      '[SankeyChartDirective] The links form a cycle, so the nodes cannot flow left to right. ' +
        'Remove a link that leads back to an earlier node.',
    );
  }

  return null;
};

const firstNodeIndexes = (nodes: readonly SankeyLayoutNodeInput[]) => {
  const seen = new Set<string>();

  return nodes.flatMap((node, index) => {
    if (seen.has(node.id)) return [];

    seen.add(node.id);

    return [index];
  });
};

/**
 * A cycle lays out empty, an invalid link is skipped and a node repeating an earlier id is left out.
 * Check the data with `findSankeyDataError` first.
 */
export const computeSankeyLayout = ({
  nodes: allNodeInputs,
  links: linkInputs,
  ...options
}: SankeyLayoutInput): SankeyLayout => {
  const inputIndexes = firstNodeIndexes(allNodeInputs);
  const nodeInputs = inputIndexes.map((index) => allNodeInputs[index] as SankeyLayoutNodeInput);
  const { edges } = readEdges(nodeInputs, linkInputs);
  const nodeCount = nodeInputs.length;

  const direction = options.direction ?? 'horizontal';
  const empty = { ...EMPTY_SANKEY_LAYOUT, direction };

  if (!nodeCount) return empty;

  const columnOf = assignSankeyColumns(nodeCount, edges);

  if (!columnOf) return empty;

  const columnCount = Math.max(...columnOf) + 1;
  const incoming = new Array<number>(nodeCount).fill(0);
  const outgoing = new Array<number>(nodeCount).fill(0);
  const edgesIn: Edge[][] = Array.from({ length: nodeCount }, () => []);
  const edgesOut: Edge[][] = Array.from({ length: nodeCount }, () => []);

  for (const edge of edges) {
    outgoing[edge.source] = (outgoing[edge.source] ?? 0) + edge.value;
    incoming[edge.target] = (incoming[edge.target] ?? 0) + edge.value;
    edgesOut[edge.source]?.push(edge);
    edgesIn[edge.target]?.push(edge);
  }

  const values = incoming.map((value, index) => Math.max(value, outgoing[index] ?? 0));
  let columns: number[][] = Array.from({ length: columnCount }, () => []);

  columnOf.forEach((column, index) => columns[column]?.push(index));

  const vertical = direction === 'vertical';
  const length = vertical ? options.height : options.width;
  const height = Math.max(0, vertical ? options.width : options.height);
  const tallestColumn = Math.max(...columns.map((column) => column.length));
  const gap =
    tallestColumn > 1 ? Math.max(0, Math.min(options.nodeGap, (height * MAX_GAP_SHARE) / (tallestColumn - 1))) : 0;

  const scale = columns.reduce((smallest, column) => {
    const total = column.reduce((sum, node) => sum + (values[node] ?? 0), 0);

    if (total <= 0) return smallest;

    return Math.min(smallest, (height - (column.length - 1) * gap) / total);
  }, Infinity);
  const pixelsPerValue = Number.isFinite(scale) ? Math.max(0, scale) : 0;
  const heights = values.map((value) => value * pixelsPerValue);
  const place = (order: number[][]) => placeColumns({ columns: order, heights, gap, height });
  const centersOf = (order: number[][]) => {
    const y = place(order);

    return y.map((top, index) => top + (heights[index] ?? 0) / 2);
  };

  let best = columns;
  let bestCrossings = crossingsOf({ columns, columnOf, edges });

  for (let sweep = 0; sweep < (options.iterations ?? DEFAULT_ITERATIONS) && bestCrossings > 0; sweep++) {
    for (let c = 1; c < columnCount; c++) {
      const centers = centersOf(columns);

      columns = columns.map((column, index) =>
        index === c
          ? sortByBarycenter({ column, centers, neighbours: (node) => edgesIn[node] ?? [], far: 'source' })
          : column,
      );
    }

    for (let c = columnCount - 2; c >= 0; c--) {
      const centers = centersOf(columns);

      columns = columns.map((column, index) =>
        index === c
          ? sortByBarycenter({ column, centers, neighbours: (node) => edgesOut[node] ?? [], far: 'target' })
          : column,
      );
    }

    const crossings = crossingsOf({ columns, columnOf, edges });

    if (crossings < bestCrossings) {
      best = columns;
      bestCrossings = crossings;
    }
  }

  const across = place(best);
  const step =
    columnCount > 1 ? (length - options.insetStart - options.insetEnd - options.nodeWidth) / (columnCount - 1) : 0;
  const order = new Array<number>(nodeCount).fill(0);

  best.forEach((column) => column.forEach((node, position) => (order[node] = position)));

  const along = columnOf.map((column) => options.insetStart + column * step);

  const nodes: SankeyLayoutNode[] = nodeInputs.map((node, index) => {
    const size = heights[index] ?? 0;
    const start = along[index] ?? 0;
    const offset = across[index] ?? 0;

    return {
      index,
      id: node.id,
      column: columnOf[index] ?? 0,
      order: order[index] ?? 0,
      x: vertical ? offset : start,
      y: vertical ? start : offset,
      width: vertical ? size : options.nodeWidth,
      height: vertical ? options.nodeWidth : size,
      incoming: incoming[index] ?? 0,
      outgoing: outgoing[index] ?? 0,
      value: values[index] ?? 0,
    };
  });

  const across0 = new Map<Edge, number>();
  const across1 = new Map<Edge, number>();
  const byNodeAcross = (pick: (edge: Edge) => number) => (a: Edge, b: Edge) =>
    (across[pick(a)] ?? 0) - (across[pick(b)] ?? 0) || a.index - b.index;

  nodes.forEach((node) => {
    let cursor = across[node.index] ?? 0;

    for (const edge of [...(edgesOut[node.index] ?? [])].sort(byNodeAcross((edge) => edge.target))) {
      across0.set(edge, cursor);
      cursor += edge.value * pixelsPerValue;
    }

    cursor = across[node.index] ?? 0;

    for (const edge of [...(edgesIn[node.index] ?? [])].sort(byNodeAcross((edge) => edge.source))) {
      across1.set(edge, cursor);
      cursor += edge.value * pixelsPerValue;
    }
  });

  const links: SankeyLayoutLink[] = edges.map((edge) => {
    const width = edge.value * pixelsPerValue;
    const along0 = (along[edge.source] ?? 0) + options.nodeWidth;
    const along1 = along[edge.target] ?? 0;
    const start = across0.get(edge) ?? across[edge.source] ?? 0;
    const end = across1.get(edge) ?? across[edge.target] ?? 0;

    return {
      index: edge.index,
      source: edge.source,
      target: edge.target,
      value: edge.value,
      width,
      x0: vertical ? start : along0,
      x1: vertical ? end : along1,
      y0: vertical ? along0 : start,
      y1: vertical ? along1 : end,
      path: ribbonPath({ along0, along1, across0: start, across1: end, width }, direction),
    };
  });

  return {
    nodes: nodes.map((node) => ({ ...node, index: inputIndexes[node.index] ?? node.index })),
    links,
    direction,
    columnCount,
    columnStep: step,
    pixelsPerValue,
    gap,
  };
};
