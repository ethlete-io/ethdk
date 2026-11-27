import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { blankPngOf } from '../blank-png';
import { DESIGN_DIR } from '../design-config';
import { drawStatePictures } from './accepted-pictures';
import { resolveProduct } from './resolve-product';

const pictureOf = vi.fn(
  async (options: {
    emptySlots: boolean;
    state?: string;
    fresh?: boolean;
  }): Promise<{ png: Buffer; source?: string }> => ({
    png: options.emptySlots ? blankPngOf(1, 1) : blankPngOf(2, 2),
  }),
);

vi.mock('../browser', () => ({ chromiumOf: async () => true }));
vi.mock('../thumb', () => ({ createDrawQueue: () => ({ close: async () => undefined }) }));
vi.mock('../shot', () => ({ createPartShooter: () => ({ pictureOf, close: async () => undefined }) }));
vi.mock('./system-modules', () => ({ createSystemModules: () => ({}), productModuleIdOf: () => 'chip' }));
vi.mock('../serve', () => ({
  createDesignServer: () => ({
    listen: async () => undefined,
    close: async () => undefined,
    httpServer: { address: () => ({ port: 1 }) },
    ssrLoadModule: async () => ({ default: { states: { default: {}, hover: {} } } }),
  }),
}));

const chipProduct = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-draw-pictures-'));
  const chip = join(target, DESIGN_DIR, 'app-a/components/chip/chip.ts');

  mkdirSync(dirname(chip), { recursive: true });
  writeFileSync(chip, 'export default definePart({ states: { default: {}, hover: {} } });\n');
  writeFileSync(join(target, DESIGN_DIR, 'config.json'), JSON.stringify({ products: { 'app-a': {} } }));

  return { target, product: resolveProduct({ target, name: 'app-a', config: {} }) };
};

describe('drawStatePictures', () => {
  beforeEach(() => {
    pictureOf.mockClear();
  });

  it('asks every state of a part at once, so the draw queue draws them side by side', async () => {
    const { target, product } = chipProduct();
    let inFlight = 0;
    let most = 0;

    pictureOf.mockImplementation(async () => {
      inFlight += 1;
      most = Math.max(most, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;

      return { png: blankPngOf(2, 2), source: 'drawn' };
    });

    const drawn = await drawStatePictures({ target, config: {}, product, parts: ['components/chip'] });

    expect(Object.keys(drawn.get('components/chip') as object)).toEqual(['default', 'hover']);
    expect(most).toBe(2);
  });

  it('draws a state that differs from expected once more only when its picture was kept, not drawn now', async () => {
    const { target, product } = chipProduct();

    pictureOf.mockImplementation(async (options) => ({
      png: blankPngOf(2, 2),
      source: options.state === 'hover' && !options.fresh ? 'memory' : 'drawn',
    }));

    await drawStatePictures({
      target,
      config: {},
      product,
      parts: ['components/chip'],
      expected: { 'components/chip': { default: 'other', hover: 'other' } },
    });

    expect(pictureOf.mock.calls.map(([options]) => `${options.state} ${options.fresh}`).sort()).toEqual([
      'default false',
      'hover false',
      'hover true',
    ]);
  });

  it('draws every state with its slots filled, so a change inside a slot changes the picture', async () => {
    const target = mkdtempSync(join(tmpdir(), 'cli-design-draw-pictures-'));
    const chip = join(target, DESIGN_DIR, 'app-a/components/chip/chip.ts');

    mkdirSync(dirname(chip), { recursive: true });
    writeFileSync(chip, 'export default definePart({ states: { default: {}, hover: {} } });\n');
    writeFileSync(join(target, DESIGN_DIR, 'config.json'), JSON.stringify({ products: { 'app-a': {} } }));

    const product = resolveProduct({ target, name: 'app-a', config: {} });
    const drawn = await drawStatePictures({ target, config: {}, product, parts: ['components/chip'] });

    expect(typeof drawn.get('components/chip')).toBe('object');
    expect(pictureOf).toHaveBeenCalledTimes(2);
    for (const [options] of pictureOf.mock.calls) expect(options.emptySlots).toBe(false);
  });
});
