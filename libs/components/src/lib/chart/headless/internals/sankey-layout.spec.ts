import {
  assignSankeyColumns,
  computeSankeyLayout,
  countSankeyCrossings,
  findSankeyDataError,
  SankeyLayoutInput,
  SankeyLayoutLinkInput,
} from './sankey-layout';

const OPTIONS = {
  width: 400,
  height: 200,
  nodeWidth: 10,
  nodeGap: 10,
  insetStart: 0,
  insetEnd: 0,
};

const reportedBy = ({ nodes, links }: Pick<SankeyLayoutInput, 'nodes' | 'links'>) =>
  String(findSankeyDataError(nodes, links));

const nodesOf = (...ids: string[]) => ids.map((id) => ({ id }));

const byId = (layout: ReturnType<typeof computeSankeyLayout>, id: string) => {
  const node = layout.nodes.find((entry) => entry.id === id);

  if (!node) throw new Error(`no node ${id}`);

  return node;
};

describe('assignSankeyColumns', () => {
  it('puts every node at the length of the longest path from a source', () => {
    const edges = [
      { source: 0, target: 1, value: 1 },
      { source: 1, target: 2, value: 1 },
      { source: 0, target: 2, value: 1 },
      { source: 3, target: 2, value: 1 },
    ];

    expect(assignSankeyColumns(4, edges)).toEqual([0, 1, 2, 0]);
  });

  it('returns null for a cycle', () => {
    const edges = [
      { source: 0, target: 1, value: 1 },
      { source: 1, target: 2, value: 1 },
      { source: 2, target: 1, value: 1 },
    ];

    expect(assignSankeyColumns(3, edges)).toBeNull();
  });
});

describe('computeSankeyLayout', () => {
  const flow: SankeyLayoutLinkInput[] = [
    { source: 'a', target: 'c', value: 30 },
    { source: 'b', target: 'c', value: 10 },
    { source: 'c', target: 'd', value: 25 },
    { source: 'c', target: 'e', value: 15 },
  ];

  it('assigns columns and spreads them across the width between the insets', () => {
    const layout = computeSankeyLayout({
      nodes: nodesOf('a', 'b', 'c', 'd', 'e'),
      links: flow,
      ...OPTIONS,
      insetStart: 50,
      insetEnd: 40,
    });

    expect(layout.columnCount).toBe(3);
    expect(layout.nodes.map((node) => node.column)).toEqual([0, 0, 1, 2, 2]);
    expect(byId(layout, 'a').x).toBe(50);
    expect(byId(layout, 'c').x).toBe(50 + (400 - 50 - 40 - 10) / 2);
    expect(byId(layout, 'd').x + byId(layout, 'd').width).toBe(400 - 40);
  });

  it('sizes nodes by throughput so the fullest column fills the height with its gaps', () => {
    const layout = computeSankeyLayout({ nodes: nodesOf('a', 'b', 'c', 'd', 'e'), links: flow, ...OPTIONS });

    expect(byId(layout, 'c').value).toBe(40);
    expect(byId(layout, 'c').incoming).toBe(40);
    expect(byId(layout, 'c').outgoing).toBe(40);

    const first = [byId(layout, 'a'), byId(layout, 'b')];
    const span = first.reduce((sum, node) => sum + node.height, 0) + layout.gap;

    expect(layout.gap).toBe(10);
    expect(span).toBeCloseTo(200);
    expect(byId(layout, 'a').height / byId(layout, 'b').height).toBeCloseTo(3);
    expect(byId(layout, 'c').height).toBeCloseTo(40 * layout.pixelsPerValue);

    const [top, bottom] = [...first].sort((x, y) => x.y - y.y);

    expect(bottom?.y).toBeCloseTo((top?.y ?? 0) + (top?.height ?? 0) + 10);
  });

  it('centers a column that needs less than the full height', () => {
    const layout = computeSankeyLayout({ nodes: nodesOf('a', 'b', 'c', 'd', 'e'), links: flow, ...OPTIONS });
    const middle = byId(layout, 'c');

    expect(middle.y).toBeCloseTo((200 - middle.height) / 2);
  });

  it('shrinks the gap when a tall column would not fit', () => {
    const ids = Array.from({ length: 11 }, (_, index) => `n${index}`);
    const links = ids.slice(1).map((id) => ({ source: 'n0', target: id, value: 1 }));
    const layout = computeSankeyLayout({ nodes: nodesOf(...ids), links, ...OPTIONS, height: 100, nodeGap: 20 });

    expect(layout.gap).toBeCloseTo(50 / 9);

    const targets = layout.nodes.filter((node) => node.column === 1);

    expect(targets.reduce((sum, node) => sum + node.height, 0) + 9 * layout.gap).toBeCloseTo(100);
  });

  it('gives a ribbon the width of its value at both ends and stacks them without overlap', () => {
    const layout = computeSankeyLayout({ nodes: nodesOf('a', 'b', 'c', 'd', 'e'), links: flow, ...OPTIONS });
    const c = byId(layout, 'c');
    const into = layout.links.filter((link) => link.target === c.index).sort((x, y) => x.y1 - y.y1);
    const out = layout.links.filter((link) => link.source === c.index).sort((x, y) => x.y0 - y.y0);

    for (const link of layout.links) {
      expect(link.width).toBeCloseTo(link.value * layout.pixelsPerValue);
      expect(link.path).toContain(`M${link.x0},${link.y0}`);
      expect(link.path).toContain(`L${link.x1},${link.y1 + link.width}`);
      expect(link.path).toMatch(new RegExp(`${link.x0},${link.y0 + link.width}Z$`));
    }

    expect(into[0]?.y1).toBeCloseTo(c.y);
    expect(into[1]?.y1).toBeCloseTo((into[0]?.y1 ?? 0) + (into[0]?.width ?? 0));
    expect(out[0]?.y0).toBeCloseTo(c.y);
    expect((out[1]?.y0 ?? 0) + (out[1]?.width ?? 0)).toBeCloseTo(c.y + c.height);
  });

  it('starts a ribbon at the right edge of its source and ends it at the left edge of its target', () => {
    const layout = computeSankeyLayout({ nodes: nodesOf('a', 'b', 'c', 'd', 'e'), links: flow, ...OPTIONS });
    const link = layout.links[0];

    expect(link?.x0).toBe(byId(layout, 'a').x + 10);
    expect(link?.x1).toBe(byId(layout, 'c').x);
  });

  it('turns the flow top to bottom in the vertical direction, columns becoming rows', () => {
    const nodes = nodesOf('a', 'b', 'c', 'd', 'e');
    const horizontal = computeSankeyLayout({ nodes, links: flow, ...OPTIONS, width: 200, height: 400 });
    const vertical = computeSankeyLayout({
      nodes,
      links: flow,
      ...OPTIONS,
      width: 200,
      height: 400,
      insetStart: 30,
      insetEnd: 20,
      direction: 'vertical',
    });

    expect(vertical.direction).toBe('vertical');
    expect(vertical.columnStep).toBe((400 - 30 - 20 - 10) / 2);
    expect(byId(vertical, 'a').y).toBe(30);
    expect(byId(vertical, 'c').y).toBe(30 + vertical.columnStep);
    expect(byId(vertical, 'd').y + byId(vertical, 'd').height).toBe(400 - 20);

    for (const id of ['a', 'b', 'c', 'd', 'e']) {
      const turned = byId(vertical, id);

      expect(turned.height).toBe(10);
      expect(turned.width).toBeCloseTo(turned.value * vertical.pixelsPerValue);
    }

    const [left, right] = [byId(vertical, 'a'), byId(vertical, 'b')].sort((x, y) => x.x - y.x);

    expect((left?.width ?? 0) + vertical.gap + (right?.width ?? 0)).toBeCloseTo(200);
    expect(right?.x).toBeCloseTo((left?.x ?? 0) + (left?.width ?? 0) + vertical.gap);
    expect(vertical.pixelsPerValue).not.toBeCloseTo(horizontal.pixelsPerValue);
  });

  it('runs a vertical ribbon from the bottom edge of its source to the top edge of its target', () => {
    const layout = computeSankeyLayout({
      nodes: nodesOf('a', 'b', 'c', 'd', 'e'),
      links: flow,
      ...OPTIONS,
      direction: 'vertical',
    });
    const c = byId(layout, 'c');
    const out = layout.links.filter((link) => link.source === c.index).sort((x, y) => x.x0 - y.x0);

    for (const link of layout.links) {
      const source = layout.nodes[link.source];
      const target = layout.nodes[link.target];

      expect(link.y0).toBe((source?.y ?? 0) + 10);
      expect(link.y1).toBe(target?.y);
      expect(link.path).toContain(`M${link.x0},${link.y0}`);
      expect(link.path).toContain(`L${link.x1 + link.width},${link.y1}`);
      expect(link.path).toMatch(new RegExp(`${link.x0 + link.width},${link.y0}Z$`));
    }

    expect(out[0]?.x0).toBeCloseTo(c.x);
    expect((out[1]?.x0 ?? 0) + (out[1]?.width ?? 0)).toBeCloseTo(c.x + c.width);
  });

  it('reorders a column to remove a crossing', () => {
    const nodes = nodesOf('a', 'b', 'x', 'y');
    const links = [
      { source: 'a', target: 'y', value: 10 },
      { source: 'b', target: 'x', value: 10 },
    ];

    const unordered = computeSankeyLayout({ nodes: nodes, links, ...OPTIONS, iterations: 0 });
    const ordered = computeSankeyLayout({ nodes: nodes, links, ...OPTIONS });

    expect(countSankeyCrossings(unordered.nodes, unordered.links)).toBe(1);
    expect(countSankeyCrossings(ordered.nodes, ordered.links)).toBe(0);
  });

  it('reduces crossings on a denser fixture and never ends with more than it started', () => {
    const nodes = nodesOf('s1', 's2', 's3', 'm1', 'm2', 'm3', 't1', 't2', 't3');
    const links = [
      { source: 's1', target: 'm3', value: 8 },
      { source: 's2', target: 'm2', value: 6 },
      { source: 's3', target: 'm1', value: 7 },
      { source: 's1', target: 'm2', value: 2 },
      { source: 'm1', target: 't3', value: 7 },
      { source: 'm2', target: 't2', value: 8 },
      { source: 'm3', target: 't1', value: 8 },
    ];

    const before = computeSankeyLayout({ nodes: nodes, links, ...OPTIONS, iterations: 0 });
    const after = computeSankeyLayout({ nodes: nodes, links, ...OPTIONS });

    expect(countSankeyCrossings(before.nodes, before.links)).toBeGreaterThan(0);
    expect(countSankeyCrossings(after.nodes, after.links)).toBe(0);
  });

  it('draws no ribbon for a zero-value link and lets it shape nothing', () => {
    const nodes = nodesOf('a', 'b', 'c');
    const links = [
      { source: 'a', target: 'b', value: 10 },
      { source: 'b', target: 'c', value: 0 },
    ];

    const layout = computeSankeyLayout({ nodes: nodes, links, ...OPTIONS });

    expect(layout.links).toHaveLength(1);
    expect(byId(layout, 'c').column).toBe(0);
    expect(byId(layout, 'c').height).toBe(0);
    expect(byId(layout, 'b').outgoing).toBe(0);
  });

  it('lays out nothing when every link is zero', () => {
    const layout = computeSankeyLayout({
      nodes: nodesOf('a', 'b'),
      links: [{ source: 'a', target: 'b', value: 0 }],
      ...OPTIONS,
    });

    expect(layout.pixelsPerValue).toBe(0);
    expect(layout.nodes.every((node) => node.height === 0)).toBe(true);
  });

  it('finds ET5160 for a cycle, which lays out empty', () => {
    const links = [
      { source: 'a', target: 'b', value: 1 },
      { source: 'b', target: 'a', value: 1 },
    ];

    expect(reportedBy({ nodes: nodesOf('a', 'b'), links })).toMatch(/ET5160/);
    expect(computeSankeyLayout({ nodes: nodesOf('a', 'b'), links, ...OPTIONS }).nodes).toEqual([]);
    expect(reportedBy({ nodes: nodesOf('a'), links: [{ source: 'a', target: 'a', value: 1 }] })).toMatch(/ET5160/);
  });

  it('finds ET5161 for a link to an unknown node', () => {
    expect(reportedBy({ nodes: nodesOf('a'), links: [{ source: 'a', target: 'z', value: 1 }] })).toMatch(/ET5161.*"z"/);
  });

  it('finds nothing wrong with valid data', () => {
    expect(findSankeyDataError(nodesOf('a', 'b'), [{ source: 'a', target: 'b', value: 1 }])).toBeNull();
  });

  it('leaves out a node repeating an earlier id and keeps its links on the first', () => {
    const layout = computeSankeyLayout({
      nodes: nodesOf('a', 'b', 'a'),
      links: [{ source: 'a', target: 'b', value: 5 }],
      ...OPTIONS,
    });

    expect(layout.nodes.map((node) => [node.index, node.id])).toEqual([
      [0, 'a'],
      [1, 'b'],
    ]);
    expect(layout.links).toHaveLength(1);
    expect(layout.columnStep).toBe(400 - 10);
  });

  it('keeps the input index of a node after a left-out duplicate', () => {
    const layout = computeSankeyLayout({ nodes: nodesOf('a', 'a', 'b'), links: [], ...OPTIONS });

    expect(layout.nodes.map((node) => [node.index, node.id])).toEqual([
      [0, 'a'],
      [2, 'b'],
    ]);
  });

  it('finds ET5162 for a duplicate node id', () => {
    expect(reportedBy({ nodes: nodesOf('a', 'a'), links: [] })).toMatch(/ET5162/);
  });

  it('finds ET5163 for a negative or non-finite value', () => {
    const nodes = nodesOf('a', 'b');

    expect(reportedBy({ nodes, links: [{ source: 'a', target: 'b', value: -1 }] })).toMatch(/ET5163/);
    expect(reportedBy({ nodes, links: [{ source: 'a', target: 'b', value: NaN }] })).toMatch(/ET5163/);
  });
});
