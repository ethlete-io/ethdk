import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { viteCacheOf } from '../paths';
import { withRunSignal } from '../run-abort';
import { comparePart, ShootStates } from './compare-command';
import { comparePngs, encodePng } from './part-compare';
import { cachedComparePngs, COMPARE_PIXELS } from './pixel-cache';
import { resolveProduct } from './resolve-product';

const RED = 0xff0000ff;
const BLUE = 0x0000ffff;

const pngOf = (width: number, height: number, colour: (x: number) => number) => {
  const data = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) data.writeUInt32BE(colour(x) >>> 0, (y * width + x) * 4);

  return encodePng({ width, height, data });
};

const temps: string[] = [];
const tempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), 'cli-design-pixel-cache-'));

  temps.push(dir);

  return dir;
};

afterEach(() => {
  vi.restoreAllMocks();
  temps.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

const design = pngOf(4, 1, () => RED);
const appWith = (blue: number) => pngOf(4, 1, (x) => (x < blue ? BLUE : RED));

describe('cachedComparePngs', () => {
  it('misses only the state whose picture changed between two runs, with the new px count and diff', () => {
    const dir = tempDir();
    const run = (apps: Buffer[]) => apps.map((app) => cachedComparePngs({ dir, salt: 'code', design, app }));

    const first = run([appWith(0), appWith(1), pngOf(5, 1, () => RED)]);

    expect(first.map(({ hit }) => hit)).toEqual([false, false, false]);

    const second = run([appWith(0), appWith(3), pngOf(5, 1, () => RED)]);

    expect(second.map(({ hit }) => hit)).toEqual([true, false, true]);
    expect(second.map(({ result }) => result)).toEqual([
      { kind: 'ok' },
      comparePngs({ design, app: appWith(3) }),
      comparePngs({ design, app: pngOf(5, 1, () => RED) }),
    ]);
    expect(second[1]?.result).toMatchObject({ kind: 'diff', pixels: 3 });
  });

  it('misses every state under another code salt', () => {
    const dir = tempDir();

    cachedComparePngs({ dir, salt: 'old', design, app: appWith(1) });

    expect(cachedComparePngs({ dir, salt: 'new', design, app: appWith(1) }).hit).toBe(false);
  });

  it('keeps nothing once the run is aborted mid-run, and a later run misses those states', async () => {
    const dir = tempDir();
    const gone = new AbortController();

    await withRunSignal(gone.signal, async () => {
      cachedComparePngs({ dir, salt: 'code', design, app: appWith(1) });
      gone.abort();

      expect(cachedComparePngs({ dir, salt: 'code', design, app: appWith(2) })).toMatchObject({
        hit: false,
        result: { kind: 'diff', pixels: 2 },
      });
    });

    expect(readdirSync(dir)).toHaveLength(1);
    expect(cachedComparePngs({ dir, salt: 'code', design, app: appWith(1) }).hit).toBe(true);
    expect(cachedComparePngs({ dir, salt: 'code', design, app: appWith(2) }).hit).toBe(false);
  });
});

describe('comparePart with the pixel cache', () => {
  it('prints the same lines and writes the same diff pictures from the cache, and redoes an edited state', async () => {
    const target = tempDir();
    const product = resolveProduct({ target, name: 'app-a', config: {} });
    const lines: string[] = [];

    vi.spyOn(console, 'log').mockImplementation((line: unknown) => void lines.push(String(line)));

    let blue = 1;
    const shoot: ShootStates = async () => ({
      states: { a: {}, b: {}, c: {} },
      shots: [
        { state: 'a', design, app: appWith(0) },
        { state: 'b', design, app: appWith(blue) },
        { state: 'c', design, app: pngOf(5, 1, () => RED) },
      ],
    });
    const run = async () => {
      lines.length = 0;
      await comparePart({ target, config: {}, product, part: 'components/chip', url: 'u', only: null, shoot });

      const dir = lines.at(-1)?.replace('pictures: ', '') ?? '';

      temps.push(dir);

      return {
        lines: lines.slice(0, -1),
        files: Object.fromEntries(readdirSync(dir).map((file) => [file, readFileSync(join(dir, file))])),
      };
    };

    const uncached = await run();
    const cached = await run();

    expect(existsSync(viteCacheOf(target, COMPARE_PIXELS))).toBe(true);
    expect(uncached.lines).toEqual(['a ok', 'b DIFF 1 px', 'c SIZE 4x1 vs 5x1']);
    expect(cached).toEqual(uncached);

    blue = 2;

    const edited = await run();

    expect(edited.lines).toEqual(['a ok', 'b DIFF 2 px', 'c SIZE 4x1 vs 5x1']);
    expect({ kind: 'diff', pixels: 2, diff: edited.files['b.diff.png'] }).toEqual(
      comparePngs({ design, app: appWith(2) }),
    );
    expect(edited.files['c.diff.png']).toEqual(uncached.files['c.diff.png']);
  });
});
