import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR } from '../design-config';
import { comparePart, ShootStates } from './compare-command';
import { encodePng } from './part-compare';
import { resolveProduct } from './resolve-product';

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

const compared = async (sketch?: Record<string, unknown>) => {
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
    shoot,
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
});
