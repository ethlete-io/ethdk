import { describe, expect, it, vi } from 'vitest';
import { DesignConfig } from './paths';
import { aktuellPlaceholderWarnings, identicalRenderLines } from './ready-shots';
import { ResolvedProduct } from './system/resolve-product';
import { Sketch } from './system/sketch/sketch';

vi.mock('./serve', () => ({
  createDesignServer: async () => {
    throw new Error('port in use');
  },
}));

const options = {
  target: '/nowhere',
  config: {} as DesignConfig,
  product: {} as ResolvedProduct,
  sketch: { target: 'elements/hero' } as Sketch,
};

describe('render server failure', () => {
  it('is a line ready refuses on, not silence', async () => {
    expect(await identicalRenderLines(options)).toEqual(['could not render elements/hero: port in use']);
  });

  it('is a warning that ready will refuse', async () => {
    expect(await aktuellPlaceholderWarnings(options)).toEqual([
      'ready will refuse: could not render elements/hero: port in use',
    ]);
  });
});
