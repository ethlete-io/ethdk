import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR } from '../design-config';
import { drawStatePictures } from './accepted-pictures';
import { resolveProduct } from './resolve-product';

const pictureOf = vi.fn(async (options: { emptySlots: boolean }) => ({
  png: Buffer.from(options.emptySlots ? 'slots emptied' : 'slots drawn'),
}));

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

describe('drawStatePictures', () => {
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
