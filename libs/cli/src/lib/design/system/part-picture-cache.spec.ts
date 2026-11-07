import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR } from '../paths';
import { createPartPictureCache } from './part-picture-cache';
import { partKeyOf, resolveProduct } from './resolve-product';
import { partHashOf } from './sketch/baseline';

const PICTURES = { default: 'a1', hover: 'b2' };

const checkout = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-part-picture-cache-'));
  const write = (path: string, source: string) => {
    mkdirSync(dirname(join(target, DESIGN_DIR, 'app-a', path)), { recursive: true });
    writeFileSync(join(target, DESIGN_DIR, 'app-a', path), source);
  };

  write('elements/slot/slot.ts', 'export default definePart({ states: { default: {} } });\n');
  write(
    'components/card/card.ts',
    "import slot from '@system/elements/slot';\nexport default definePart({ states: { default: {}, hover: {} } });\n",
  );
  write('components/chip/chip.ts', 'export default definePart({ states: { default: {} } });\n');
  writeFileSync(join(target, DESIGN_DIR, 'config.json'), JSON.stringify({ products: { 'app-a': {} } }));

  const product = () => resolveProduct({ target, name: 'app-a', config: {} });
  const card = () => {
    const found = product().parts.find((part) => partKeyOf(part) === 'components/card');

    if (!found) throw new Error('no card');

    return found;
  };

  return { target, write, product, card, hashOf: () => partHashOf({ product: product(), dir: dirname(card().file) }) };
};

describe('createPartPictureCache', () => {
  it('reads the pictures of a part at its part hash while every file it was drawn from is unchanged', () => {
    const { target, product, card, hashOf } = checkout();

    createPartPictureCache({ target, product: product(), code: 'c1' }).write({
      part: card(),
      partHash: hashOf(),
      states: PICTURES,
    });

    expect(createPartPictureCache({ target, product: product(), code: 'c1' }).read(card(), hashOf())).toEqual(PICTURES);
  });

  it('misses at another part hash', () => {
    const { target, product, card, hashOf } = checkout();

    createPartPictureCache({ target, product: product(), code: 'c1' }).write({
      part: card(),
      partHash: hashOf(),
      states: PICTURES,
    });

    expect(createPartPictureCache({ target, product: product(), code: 'c1' }).read(card(), 'other')).toBeNull();
  });

  it('misses after an edit of an embedded part, and keeps over an edit of a part it does not reach', () => {
    const { target, write, product, card, hashOf } = checkout();
    const read = () => createPartPictureCache({ target, product: product(), code: 'c1' }).read(card(), hashOf());

    createPartPictureCache({ target, product: product(), code: 'c1' }).write({
      part: card(),
      partHash: hashOf(),
      states: PICTURES,
    });
    write('components/chip/chip.ts', 'export default definePart({ states: { default: {}, focus: {} } });\n');

    expect(read()).toEqual(PICTURES);

    write('elements/slot/slot.ts', 'export default definePart({ states: { default: {}, empty: {} } });\n');

    expect(read()).toBeNull();
  });

  it('misses under other design picture code', () => {
    const { target, product, card, hashOf } = checkout();

    createPartPictureCache({ target, product: product(), code: 'c1' }).write({
      part: card(),
      partHash: hashOf(),
      states: PICTURES,
    });

    expect(createPartPictureCache({ target, product: product(), code: 'c2' }).read(card(), hashOf())).toBeNull();
  });
});
