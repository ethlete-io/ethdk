export type SankeyKeyboardMark = { kind: 'node' | 'link'; key: string };

export type SankeyKeyboardNode = { key: string; column: number; y: number; height: number };

export type SankeyKeyboardLink = { key: string; source: { key: string } };

/** `nodes` must be column by column, top to bottom, and `links` grouped by source, top to bottom. */
export type SankeyKeyboardMarks = {
  nodes: readonly SankeyKeyboardNode[];
  links: readonly SankeyKeyboardLink[];
};

const nodeMark = (node: SankeyKeyboardNode): SankeyKeyboardMark => ({ kind: 'node', key: node.key });

const linkMark = (link: SankeyKeyboardLink): SankeyKeyboardMark => ({ kind: 'link', key: link.key });

const centerOf = (node: SankeyKeyboardNode) => node.y + node.height / 2;

const nearestInNextColumn = (
  { nodes }: SankeyKeyboardMarks,
  { from, direction }: { from: SankeyKeyboardNode; direction: 1 | -1 },
): SankeyKeyboardNode => {
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

  switch (key) {
    case 'ArrowDown':
      return nodeMark(column[Math.min(position + 1, column.length - 1)] ?? node);
    case 'ArrowUp':
      return nodeMark(column[Math.max(position - 1, 0)] ?? node);
    case 'ArrowRight':
      return nodeMark(nearestInNextColumn(marks, { from: node, direction: 1 }));
    case 'ArrowLeft':
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
  { links }: SankeyKeyboardMarks,
  { key, link }: { key: string; link: SankeyKeyboardLink },
): SankeyKeyboardMark | null => {
  const siblings = links.filter((entry) => entry.source.key === link.source.key);
  const position = siblings.indexOf(link);
  const count = siblings.length;

  switch (key) {
    case 'ArrowDown':
      return linkMark(siblings[(position + 1) % count] ?? link);
    case 'ArrowUp':
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
