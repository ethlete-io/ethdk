import { cpSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../design-config';
import { resolveProduct } from '../resolve-product';
import { recordMerged } from '../sketch/merged-parts';
import { directEditPendingOf } from './direct-edit-pending';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-direct-edit-'));

  cpSync(join(__dirname, '../__fixtures__'), target, { recursive: true });

  const dir = join(target, DESIGN_DIR, 'acme');
  const resolve = () => resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });

  return { dir, resolve };
};

describe('directEditPendingOf', () => {
  it('passes a part that was never merged and a merged part that still matches its hash', () => {
    const { dir, resolve } = acme();

    expect(directEditPendingOf(resolve())).toEqual([]);

    recordMerged({ product: { dir, base: null }, parts: ['elements/hero'] });

    expect(directEditPendingOf(resolve())).toEqual([]);
  });

  it('reports a merged part whose files moved without a merged.json entry, on the part', () => {
    const { dir, resolve } = acme();

    recordMerged({ product: { dir, base: null }, parts: ['elements/hero'] });
    writeFileSync(join(dir, 'elements/hero/hero.css'), '.acme-hero { padding: 0; }');

    expect(directEditPendingOf(resolve())).toEqual([
      expect.objectContaining({
        rule: 'DIRECT-EDIT-PENDING',
        at: 'merged-hash',
        message: expect.stringContaining('elements/hero changed since its merged hash'),
      }),
    ]);
  });

  it('passes again once the new state is recorded as merged', () => {
    const { dir, resolve } = acme();

    recordMerged({ product: { dir, base: null }, parts: ['elements/hero'] });
    writeFileSync(join(dir, 'elements/hero/hero.css'), '.acme-hero { padding: 0; }');
    recordMerged({ product: { dir, base: null }, parts: ['elements/hero'] });

    expect(directEditPendingOf(resolve())).toEqual([]);
  });
});
