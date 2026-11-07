import { mkdirSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WarmDraw } from '../warm-draw';
import { partsCompletenessOf } from './complete';
import { INSPECTS_AT_ONCE } from './render-check';
import { ResolvedProduct } from './resolve-product';

const NAMES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

let product: ResolvedProduct;

vi.mock('./sketch/baseline', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./sketch/baseline')>()),
  partHashOf: () => 'hash',
}));
vi.mock('./system-modules', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./system-modules')>()),
  createSystemModules: () => ({ drawnOf: () => ({ presets: {}, parts: product.parts }), productOf: () => product }),
}));

const drawer = () => {
  let inFlight = 0;
  let maxInFlight = 0;
  let calls = 0;

  const warm = {
    server: async () => ({
      httpServer: { address: () => ({ address: '::1', family: 'IPv6', port: 1 }) },
      ssrLoadModule: async (id: string) => {
        if (id.includes('/b/')) throw new Error('b does not load');
        if (id.includes('/a/'))
          return {
            default: {
              states: {},
              controls: Object.fromEntries(
                NAMES.slice(1).map((name) => [name, { kind: 'button', part: `components/${name}` }]),
              ),
            },
          };

        return { default: { states: {} } };
      },
    }),
    queue: () => ({
      run: async () => {
        const wait = (NAMES.length - calls++) * 5;

        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, wait));
        inFlight--;

        return { seen: [], refused: [`drawn after ${wait}ms`], changes: [] };
      },
    }),
  } as unknown as WarmDraw;

  return { warm, maxInFlight: () => maxInFlight, calls: () => calls };
};

describe('partsCompletenessOf', () => {
  beforeEach(() => {
    const target = mkdtempSync(join(tmpdir(), 'completeness-parallel-'));

    product = {
      name: 'studio',
      dir: target,
      base: null,
      parts: NAMES.map((name) => {
        const dir = join(target, 'components', name);

        mkdirSync(dir, { recursive: true });

        return { file: join(dir, `${name}.ts`), layer: 'components', name, origin: 'product', source: '' };
      }),
    } as unknown as ResolvedProduct;
  });

  it('draws parts at the render-check concurrency and answers them in the order asked', async () => {
    const { warm, maxInFlight, calls } = drawer();
    const parts = NAMES.map((name) => `components/${name}`).reverse();

    const result = await partsCompletenessOf({
      target: product.dir,
      config: {} as never,
      product,
      parts,
      chromiumOf: async () => ({ chromium: {} as never, from: '/playwright' }),
      warm,
    });

    if ('unavailable' in result) throw new Error(result.unavailable);

    expect(maxInFlight()).toBe(INSPECTS_AT_ONCE);
    expect(calls()).toBe(NAMES.length - 1);
    expect([...result.gaps.keys()]).toEqual(parts);
    expect(result.gaps.get('components/b')).toEqual([
      { code: 'RENDER', target: 'components/b', detail: 'b does not load' },
    ]);
  });

  it('draws the parts a part names at the same concurrency', async () => {
    const { warm, maxInFlight, calls } = drawer();

    const result = await partsCompletenessOf({
      target: product.dir,
      config: {} as never,
      product,
      parts: ['components/a'],
      chromiumOf: async () => ({ chromium: {} as never, from: '/playwright' }),
      warm,
    });

    if ('unavailable' in result) throw new Error(result.unavailable);

    expect(maxInFlight()).toBe(INSPECTS_AT_ONCE);
    expect(calls()).toBe(NAMES.length - 1);
    expect([...result.gaps.keys()]).toEqual(['components/a']);
  });
});
