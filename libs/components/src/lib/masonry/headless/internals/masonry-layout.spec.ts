import { packMasonryItems, resolveMasonryColumns } from './masonry-layout';

// The column each item landed in, which is what the packing is really about.
const columns = (itemBlockSizes: number[], columnCount: number) =>
  packMasonryItems({ itemBlockSizes, columnCount, columnInlineSize: 100, gap: 0 }).placements.map((p) => p.column);

describe('resolveMasonryColumns', () => {
  it('reports no columns until the container has been measured', () => {
    expect(resolveMasonryColumns({ containerInlineSize: 0, minColumnInlineSize: 250, gap: 16 })).toEqual({
      count: 0,
      inlineSize: 0,
    });
  });

  it('treats the column width as a minimum, counting the gaps', () => {
    // Four 250px columns plus three 16px gaps need 1048px, so 1000px only fits three.
    const { count, inlineSize } = resolveMasonryColumns({
      containerInlineSize: 1000,
      minColumnInlineSize: 250,
      gap: 16,
    });

    expect(count).toBe(3);
    expect(inlineSize).toBeCloseTo((1000 - 2 * 16) / 3);
    expect(inlineSize).toBeGreaterThanOrEqual(250);
  });

  it('shares the remainder out so the columns fill the container', () => {
    const gap = 20;
    const { count, inlineSize } = resolveMasonryColumns({
      containerInlineSize: 860,
      minColumnInlineSize: 200,
      gap,
    });

    expect(count).toBe(4);
    expect(count * inlineSize + (count - 1) * gap).toBeCloseTo(860);
  });

  it('keeps one column when the container is narrower than a single one', () => {
    expect(resolveMasonryColumns({ containerInlineSize: 120, minColumnInlineSize: 400, gap: 16 }).count).toBe(1);
  });

  it('survives a zero or negative column width', () => {
    expect(resolveMasonryColumns({ containerInlineSize: 500, minColumnInlineSize: 0, gap: 0 }).count).toBeGreaterThan(
      0,
    );
    expect(
      resolveMasonryColumns({ containerInlineSize: 500, minColumnInlineSize: -10, gap: -5 }).count,
    ).toBeGreaterThan(0);
  });
});

describe('packMasonryItems', () => {
  it('places nothing while there are no columns', () => {
    expect(packMasonryItems({ itemBlockSizes: [10, 20], columnCount: 0, columnInlineSize: 100, gap: 8 })).toEqual({
      placements: [],
      columnBlockSizes: [],
      blockSize: 0,
    });
  });

  it('fills the first row from the start before doubling up', () => {
    expect(columns([100, 100, 100], 3)).toEqual([0, 1, 2]);
  });

  it('sends each item to the shortest column', () => {
    // Row one leaves the columns at 300 / 100 / 200, so the three short items that follow all pile into the
    // middle one — which is exactly the balancing a row-major grid can't do.
    expect(columns([300, 100, 200, 50, 50, 50], 3)).toEqual([0, 1, 2, 1, 1, 1]);
  });

  it('breaks a tie towards the start', () => {
    expect(columns([100, 100, 100, 10], 3)).toEqual([0, 1, 2, 0]);
  });

  it('offsets each item by the columns and gaps before it', () => {
    const { placements } = packMasonryItems({
      itemBlockSizes: [50, 50, 50],
      columnCount: 3,
      columnInlineSize: 200,
      gap: 16,
    });

    expect(placements.map((p) => p.inlineOffset)).toEqual([0, 216, 432]);
    expect(placements.map((p) => p.blockOffset)).toEqual([0, 0, 0]);
  });

  it('stacks items in a column with a gap between them', () => {
    const { placements, blockSize } = packMasonryItems({
      itemBlockSizes: [100, 60],
      columnCount: 1,
      columnInlineSize: 200,
      gap: 16,
    });

    expect(placements.map((p) => p.blockOffset)).toEqual([0, 116]);
    // No trailing gap below the last item.
    expect(blockSize).toBe(176);
  });

  it('takes the container height from the tallest column', () => {
    const { blockSize } = packMasonryItems({
      itemBlockSizes: [300, 100],
      columnCount: 2,
      columnInlineSize: 100,
      gap: 10,
    });

    expect(blockSize).toBe(300);
  });

  it('has no height without items', () => {
    expect(packMasonryItems({ itemBlockSizes: [], columnCount: 3, columnInlineSize: 100, gap: 16 }).blockSize).toBe(0);
  });

  it('is prefix-stable, so appending items never moves the ones already placed', () => {
    const base = [120, 80, 200, 60, 140];
    const shared = { columnCount: 3, columnInlineSize: 200, gap: 16 };

    const before = packMasonryItems({ itemBlockSizes: base, ...shared });
    const after = packMasonryItems({ itemBlockSizes: [...base, 90, 30, 175], ...shared });

    expect(after.placements.slice(0, base.length)).toEqual(before.placements);
  });

  it('keeps pinned items in their column and stacks them there', () => {
    const { placements } = packMasonryItems({
      itemBlockSizes: [100, 100, 40],
      // The third item would go greedily to column 1; pinning holds it in column 0 below the first.
      itemColumns: [0, 1, 0],
      columnCount: 2,
      columnInlineSize: 200,
      gap: 10,
    });

    expect(placements.map((p) => p.column)).toEqual([0, 1, 0]);
    expect(placements[2]).toEqual({ column: 0, inlineOffset: 0, blockOffset: 110 });
  });

  it('places items greedily where the pin is null or out of range', () => {
    const { placements } = packMasonryItems({
      itemBlockSizes: [100, 100, 40, 40],
      itemColumns: [0, null, 7, -1],
      columnCount: 3,
      columnInlineSize: 200,
      gap: 0,
    });

    // The pinned first item, then three placed greedily — the last one landing on the 40px column, which is
    // the shortest by then.
    expect(placements.map((p) => p.column)).toEqual([0, 1, 2, 2]);
  });

  it('treats a negative measurement as empty rather than pulling the column back up', () => {
    const { columnBlockSizes } = packMasonryItems({
      itemBlockSizes: [-50],
      columnCount: 1,
      columnInlineSize: 100,
      gap: 10,
    });

    expect(columnBlockSizes).toEqual([10]);
  });
});
