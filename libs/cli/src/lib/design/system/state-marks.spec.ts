import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { DESIGN_DIR } from '../design-config';
import { writePictures } from './accepted-pictures';
import { PartPictureCache } from './part-picture-cache';
import { partKeyOf, ResolvedPart, resolveProduct } from './resolve-product';
import { partHashOf } from './sketch/baseline';
import { recordMerged } from './sketch/merged-parts';
import { changedStatesSinceMergeOf, problemStatesOf } from './state-marks';

const CHIP = 'components/chip';

const targets: string[] = [];

afterEach(() => {
  for (const target of targets.splice(0)) rmSync(target, { recursive: true, force: true });
});

const checkout = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-state-marks-'));
  const design = join(target, DESIGN_DIR);
  const chip = join(design, 'app-a/components/chip/chip.ts');

  targets.push(target);
  mkdirSync(dirname(chip), { recursive: true });
  writeFileSync(chip, 'export default definePart({ states: { default: {}, hover: {}, busy: {} } });\n');
  writeFileSync(join(design, 'config.json'), JSON.stringify({ products: { 'app-a': {} } }));

  const productOf = () => resolveProduct({ target, name: 'app-a', config: {} });
  const merge = (states: Record<string, string>) => {
    const product = productOf();

    recordMerged({ product, parts: [CHIP] });
    writePictures({
      dir: product.dir,
      part: CHIP,
      pictures: { hash: 'design', states, partHash: partHashOf({ product, dir: dirname(chip) }) },
    });
  };

  return { target, chip, productOf, merge };
};

const cacheOf = (pictures: Record<string, Record<string, string>>): PartPictureCache => ({
  read: (part: ResolvedPart, partHash: string) => pictures[`${partKeyOf(part)} ${partHash}`] ?? null,
  write: () => undefined,
});

describe('problemStatesOf', () => {
  it('places a problem at the state its at or its message names', () => {
    expect(
      problemStatesOf(
        ['default', 'hover', 'busy', 'busy-long', 'error'],
        [
          { at: 'hover', message: 'm' },
          { at: 'busy at 320: .label', message: 'm' },
          { at: 'save-button', message: 'm' },
          { message: 'state "error" sets kind' },
          { message: 'no state named' },
        ],
      ),
    ).toEqual(['hover', 'busy', 'error']);
  });
});

describe('changedStatesSinceMergeOf', () => {
  it('names the states whose drawn picture differs from the merged one', () => {
    const { target, chip, productOf, merge } = checkout();

    merge({ default: 'a', hover: 'b', busy: 'c' });
    writeFileSync(chip, 'export default definePart({ states: { default: {}, hover: { x: 1 }, busy: {} } });\n');

    const product = productOf();
    const now = partHashOf({ product, dir: dirname(chip) });
    const cache = cacheOf({ [`${CHIP} ${now}`]: { default: 'a', hover: 'B', busy: 'c' } });

    expect(changedStatesSinceMergeOf({ target, product, cache }).get(CHIP)).toEqual(['hover']);
  });

  it('names no state while the part is as merged or its current pictures were never drawn', () => {
    const { target, chip, productOf, merge } = checkout();

    merge({ default: 'a', hover: 'b', busy: 'c' });

    const unchanged = changedStatesSinceMergeOf({ target, product: productOf(), cache: cacheOf({}) });

    writeFileSync(chip, 'export default definePart({ states: { default: {}, hover: { x: 1 }, busy: {} } });\n');

    expect(unchanged.size).toBe(0);
    expect(changedStatesSinceMergeOf({ target, product: productOf(), cache: cacheOf({}) }).size).toBe(0);
  });

  it('reads the merged pictures from the picture cache when the record holds an older merge', () => {
    const { target, chip, productOf, merge } = checkout();

    merge({ default: 'a', hover: 'b', busy: 'c' });

    const merged = partHashOf({ product: productOf(), dir: dirname(chip) });

    writeFileSync(chip, 'export default definePart({ states: { default: {}, hover: {}, busy: { y: 1 } } });\n');
    writePictures({ dir: productOf().dir, part: CHIP, pictures: { hash: 'design', states: {}, partHash: 'older' } });

    const product = productOf();
    const now = partHashOf({ product, dir: dirname(chip) });
    const cache = cacheOf({
      [`${CHIP} ${merged}`]: { default: 'a', hover: 'b', busy: 'c' },
      [`${CHIP} ${now}`]: { default: 'a', hover: 'b', busy: 'C' },
    });

    expect(changedStatesSinceMergeOf({ target, product, cache }).get(CHIP)).toEqual(['busy']);
  });

  it('names a state the merge did not draw, and not one the part dropped', () => {
    const { target, chip, productOf, merge } = checkout();

    merge({ default: 'a', hover: 'b', gone: 'g' });
    writeFileSync(chip, 'export default definePart({ states: { default: {}, hover: {}, busy: { x: 1 } } });\n');

    const product = productOf();
    const now = partHashOf({ product, dir: dirname(chip) });
    const cache = cacheOf({ [`${CHIP} ${now}`]: { default: 'a', hover: 'b', busy: 'c' } });

    expect(changedStatesSinceMergeOf({ target, product, cache }).get(CHIP)).toEqual(['busy']);
  });
});
