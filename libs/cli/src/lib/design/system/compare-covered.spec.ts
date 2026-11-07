import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR } from '../paths';
import { comparePart, ShootStates } from './compare-command';
import { encodePng } from './part-compare';
import { resolveProduct } from './resolve-product';
import { parseCover } from './sketch/covered-diffs';

const solid = (rgba: number[]) => encodePng({ width: 1, height: 1, data: Buffer.from(rgba) });
const RED = [255, 0, 0, 255];
const BLUE = [0, 0, 255, 255];

const checkout = (sketch?: Record<string, unknown>) => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-compare-covered-'));
  const product = join(target, DESIGN_DIR, 'app-a');

  mkdirSync(join(product, 'components/chip'), { recursive: true });
  writeFileSync(
    join(product, 'components/chip/chip.ts'),
    "export default definePart({ implements: 'libs/chip/chip.component.ts', states: { default: {} } });\n",
  );
  writeFileSync(join(target, DESIGN_DIR, 'config.json'), JSON.stringify({ products: { 'app-a': {} } }));

  if (sketch) {
    mkdirSync(join(product, 'sketches/components-chip.all-states/a'), { recursive: true });
    writeFileSync(
      join(product, 'sketches/components-chip.all-states/sketch.json'),
      JSON.stringify({
        target: 'components/chip@all-states',
        status: 'in progress',
        createdAt: '2026-11-07',
        ...sketch,
      }),
    );
  }

  return { target, product: resolveProduct({ target, name: 'app-a', config: {} }) };
};

const shoot: ShootStates = async () => ({
  states: { default: {}, folded: {} },
  shots: [
    { state: 'default', design: solid(RED), app: solid(RED) },
    { state: 'folded', design: solid(RED), app: solid(BLUE) },
  ],
});

const square = (paint: (x: number, y: number) => number[]) =>
  encodePng({
    width: 4,
    height: 4,
    data: Buffer.from(Array.from({ length: 16 }, (_, i) => paint(i % 4, Math.floor(i / 4))).flat()),
  });

const corner: ShootStates = async () => ({
  states: { default: {}, folded: {} },
  shots: [
    { state: 'default', design: solid(RED), app: solid(RED) },
    { state: 'folded', design: square(() => RED), app: square((x, y) => (x === 3 && y === 3 ? BLUE : RED)) },
  ],
});

const compared = async (sketch?: Record<string, unknown>, shots: ShootStates = shoot) => {
  const { target, product } = checkout(sketch);
  const lines: string[] = [];

  vi.spyOn(console, 'log').mockImplementation((line: unknown) => void lines.push(String(line)));

  const result = await comparePart({
    target,
    config: {},
    product,
    part: 'components/chip',
    url: 'u',
    only: null,
    shoot: shots,
  });

  return { result, lines };
};

describe('compare DIFFs an open sketch covers (ADR 0222)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('lists a DIFF the open sketch names with the sketch and does not fail it', async () => {
    const { result, lines } = await compared({ covers: ['folded'] });

    expect(result).toMatchObject({ green: true });
    expect(lines).toEqual([
      'default ok',
      'folded DIFF 1 px (covered by open sketch components/chip@all-states, ADR 0222)',
    ]);
  });

  it('fails a DIFF in a state the sketch does not name', async () => {
    const { result, lines } = await compared({ covers: ['default'] });

    expect(result).toMatchObject({ green: false });
    expect(lines[1]).toBe('folded DIFF 1 px');
  });

  it('fails the DIFF without a sketch, and when the sketch is closed by a decision', async () => {
    expect((await compared()).result).toMatchObject({ green: false });

    vi.restoreAllMocks();

    const closed = await compared({
      covers: ['folded'],
      decision: { kind: 'pick', variant: 'a', decidedAt: '2026-11-07' },
    });

    expect(closed.result).toMatchObject({ green: false });
    expect(closed.lines[1]).toBe('folded DIFF 1 px');
  });

  it('covers a DIFF inside the region the sketch names, and fails one outside it', async () => {
    const inside = await compared({ covers: ['folded@2,2,2,2'] }, corner);

    expect(inside.result).toMatchObject({ green: true });
    expect(inside.lines[1]).toBe('folded DIFF 1 px (covered by open sketch components/chip@all-states, ADR 0222)');

    vi.restoreAllMocks();

    const outside = await compared({ covers: ['folded@0,0,3,3'] }, corner);

    expect(outside.result).toMatchObject({ green: false });
    expect(outside.lines[1]).toBe('folded DIFF 1 px');
  });

  it('takes a qualified cover for its own part only when the sketch has several targets', async () => {
    const two = ['components/chip', 'components/card'];
    const mine = await compared({ targets: two, covers: ['components/chip:folded'] });

    expect(mine.result).toMatchObject({ green: true });
    expect(mine.lines[1]).toContain('covered by open sketch');

    vi.restoreAllMocks();

    const other = await compared({ targets: two, covers: ['components/card:folded'] });

    expect(other.result).toMatchObject({ green: false });
    expect(other.lines[1]).toBe('folded DIFF 1 px');

    vi.restoreAllMocks();

    const bare = await compared({ targets: two, covers: ['folded'] });

    expect(bare.result).toMatchObject({ green: false });

    vi.restoreAllMocks();

    expect((await compared({ covers: ['components/chip:folded'] })).result).toMatchObject({ green: true });
  });

  it('does not cover a size change with a region', async () => {
    const sized: ShootStates = async () => ({
      states: { folded: {} },
      shots: [{ state: 'folded', design: solid(RED), app: square(() => RED) }],
    });

    expect((await compared({ covers: ['folded@0,0,4,4'] }, sized)).result).toMatchObject({ green: false });
  });
});

describe('parseCover', () => {
  it('reads a state and a region, and refuses a broken region', () => {
    expect(parseCover('folded')).toEqual({ part: null, state: 'folded', box: null });
    expect(parseCover('folded@1,2,30,40')).toEqual({
      part: null,
      state: 'folded',
      box: { x: 1, y: 2, width: 30, height: 40 },
    });
    expect(parseCover('components/chip:folded@1,2,3,4')).toEqual({
      part: 'components/chip',
      state: 'folded',
      box: { x: 1, y: 2, width: 3, height: 4 },
    });
    expect(parseCover('nonsense/:folded')).toContain('names no part');
    expect(parseCover('folded@1,2,0,4')).toContain('has no region');
    expect(parseCover('folded@top')).toContain('has no region');
    expect(parseCover('@1,2,3,4')).toContain('names no state');
  });
});

describe('compare names the interaction states it skips', () => {
  afterEach(() => vi.restoreAllMocks());

  it('prints the unchanged row states before the state lines', async () => {
    const { target, product } = checkout();
    const lines: string[] = [];

    vi.spyOn(console, 'log').mockImplementation((line: unknown) => void lines.push(String(line)));

    await comparePart({
      target,
      config: {},
      product,
      part: 'components/chip',
      url: 'u',
      only: null,
      shoot: async () => ({
        states: { default: {} },
        shots: [{ state: 'default', design: solid(RED), app: solid(RED) }],
        skipped: ['default-hover', 'default-active'],
      }),
    });

    expect(lines).toEqual([
      'skipped 2 interaction states (unchanged SDK controls): default-hover, default-active',
      'default ok',
    ]);
  });
});
