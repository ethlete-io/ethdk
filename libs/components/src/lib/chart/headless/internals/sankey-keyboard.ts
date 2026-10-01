export type SankeyKeyboardMark = { kind: 'node' | 'link'; key: string };

export type SankeyKeyboardNode = { key: string; column: number; x: number; y: number; width: number; height: number };

export type SankeyKeyboardLink = { key: string; source: { key: string } };

/**
 * `nodes` must be column by column, in reading order across the flow, and `links` grouped by source in
 * the same order. A `vertical` flow walks its columns with ↑ and ↓ and the nodes of one with ← and →.
 */
export type SankeyKeyboardMarks = {
  nodes: readonly SankeyKeyboardNode[];
  links: readonly SankeyKeyboardLink[];
  direction?: 'horizontal' | 'vertical';
};

type FlowKeys = { nextColumn: string; previousColumn: string; nextInColumn: string; previousInColumn: string };

const HORIZONTAL_KEYS: FlowKeys = {
  nextColumn: 'ArrowRight',
  previousColumn: 'ArrowLeft',
  nextInColumn: 'ArrowDown',
  previousInColumn: 'ArrowUp',
};

const VERTICAL_KEYS: FlowKeys = {
  nextColumn: 'ArrowDown',
  previousColumn: 'ArrowUp',
  nextInColumn: 'ArrowRight',
  previousInColumn: 'ArrowLeft',
};

const keysOf = ({ direction }: SankeyKeyboardMarks) => (direction === 'vertical' ? VERTICAL_KEYS : HORIZONTAL_KEYS);

const nodeMark = (node: SankeyKeyboardNode): SankeyKeyboardMark => ({ kind: 'node', key: node.key });

const linkMark = (link: SankeyKeyboardLink): SankeyKeyboardMark => ({ kind: 'link', key: link.key });

const nearestInNextColumn = (
  { nodes, direction: flow }: SankeyKeyboardMarks,
  { from, direction }: { from: SankeyKeyboardNode; direction: 1 | -1 },
): SankeyKeyboardNode => {
  const centerOf = (node: SankeyKeyboardNode) =>
    flow === 'vertical' ? node.x + node.width / 2 : node.y + node.height / 2;
  const columns = [...new Set(nodes.map((node) => node.column))].sort((a, b) => a - b);
  const column = columns[columns.indexOf(from.column) + direction];

  if (column === undefined) return from;

  const center = centerOf(from);

  return nodes
    .filter((node) => node.column === column)
    .reduce((best, node) => (Math.abs(centerOf(node) - center) < Math.abs(centerOf(best) - center) ? node : best));
};

const nodeTarget = (
  marks: SankeyKeyboardMarks,
  { key, node }: { key: string; node: SankeyKeyboardNode },
): SankeyKeyboardMark | null => {
  const { nodes, links } = marks;
  const column = nodes.filter((entry) => entry.column === node.column);
  const position = column.indexOf(node);
  const outgoing = links.find((link) => link.source.key === node.key);
  const keys = keysOf(marks);

  switch (key) {
    case keys.nextInColumn:
      return nodeMark(column[Math.min(position + 1, column.length - 1)] ?? node);
    case keys.previousInColumn:
      return nodeMark(column[Math.max(position - 1, 0)] ?? node);
    case keys.nextColumn:
      return nodeMark(nearestInNextColumn(marks, { from: node, direction: 1 }));
    case keys.previousColumn:
      return nodeMark(nearestInNextColumn(marks, { from: node, direction: -1 }));
    case 'Home':
      return nodeMark(nodes[0] ?? node);
    case 'End':
      return nodeMark(nodes[nodes.length - 1] ?? node);
    case 'Enter':
      return outgoing ? linkMark(outgoing) : null;
    default:
      return null;
  }
};

const linkTarget = (
  marks: SankeyKeyboardMarks,
  { key, link }: { key: string; link: SankeyKeyboardLink },
): SankeyKeyboardMark | null => {
  const siblings = marks.links.filter((entry) => entry.source.key === link.source.key);
  const position = siblings.indexOf(link);
  const count = siblings.length;
  const keys = keysOf(marks);

  switch (key) {
    case keys.nextInColumn:
      return linkMark(siblings[(position + 1) % count] ?? link);
    case keys.previousInColumn:
      return linkMark(siblings[(position - 1 + count) % count] ?? link);
    case 'Home':
      return linkMark(siblings[0] ?? link);
    case 'End':
      return linkMark(siblings[count - 1] ?? link);
    case 'Escape':
      return { kind: 'node', key: link.source.key };
    default:
      return null;
  }
};

/** The mark a key press moves the chart's focus to, or `null` when the key does nothing there. */
export const findSankeyKeyTarget = (
  marks: SankeyKeyboardMarks,
  { key, mark }: { key: string; mark: SankeyKeyboardMark },
): SankeyKeyboardMark | null => {
  if (mark.kind === 'node') {
    const node = marks.nodes.find((entry) => entry.key === mark.key);

    return node ? nodeTarget(marks, { key, node }) : null;
  }

  const link = marks.links.find((entry) => entry.key === mark.key);

  return link ? linkTarget(marks, { key, link }) : null;
};
