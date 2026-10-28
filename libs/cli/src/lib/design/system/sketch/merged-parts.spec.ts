import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../paths';
import { resolveProduct } from '../resolve-product';
import { changedOutsideSketchOf, MERGED_FILE, readMerged, recordMerged } from './merged-parts';
import { createSketch } from './sketch';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-merged-'));

  cpSync(join(__dirname, '..', '__fixtures__'), target, { recursive: true });

  return target;
};

const resolveAcme = (target: string) =>
  resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });

const productDir = (target: string) => join(target, DESIGN_DIR, 'acme');

const changeHero = (target: string) =>
  writeFileSync(join(productDir(target), 'elements/hero/hero.css'), '.acme-hero { padding: 0; }');

describe('changedOutsideSketchOf', () => {
  it('names a merged part whose files changed since its merge, and only that one', () => {
    const target = acme();

    recordMerged({ productDir: productDir(target), parts: ['elements/hero', 'pages/home'] });

    expect(changedOutsideSketchOf(resolveAcme(target))).toEqual([]);

    changeHero(target);
    writeFileSync(join(productDir(target), 'components/button/button.css'), '.acme-button { padding: 0; }');

    expect(changedOutsideSketchOf(resolveAcme(target))).toEqual(['elements/hero']);
  });

  it('skips a part an open sketch holds', () => {
    const target = acme();

    recordMerged({ productDir: productDir(target), parts: ['elements/hero'] });
    changeHero(target);
    createSketch({ product: resolveAcme(target), sketch: { layer: 'elements', name: 'hero' }, variants: ['a'] });

    expect(changedOutsideSketchOf(resolveAcme(target))).toEqual([]);
  });

  it('clears once the part is recorded again, and keeps the other records', () => {
    const target = acme();

    recordMerged({ productDir: productDir(target), parts: ['elements/hero', 'pages/home'] });
    changeHero(target);
    recordMerged({ productDir: productDir(target), parts: ['elements/hero'] });

    expect(changedOutsideSketchOf(resolveAcme(target))).toEqual([]);
    expect(Object.keys(readMerged(productDir(target)))).toEqual(['elements/hero', 'pages/home']);
  });

  it('reads an unreadable record as none', () => {
    const target = acme();

    writeFileSync(join(productDir(target), MERGED_FILE), '{');

    expect(readMerged(productDir(target))).toEqual({});
    expect(changedOutsideSketchOf(resolveAcme(target))).toEqual([]);
    expect(readFileSync(join(productDir(target), MERGED_FILE), 'utf8')).toBe('{');
  });
});
