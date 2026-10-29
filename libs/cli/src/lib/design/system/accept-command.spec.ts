import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR, readConfig } from '../paths';
import { designAccept } from './accept-command';
import { resolveProduct } from './resolve-product';
import { ACCEPTED_FILE, changedOutsideSketchOf, readAccepted, recordMerged } from './sketch/merged-parts';
import { createSketch } from './sketch/sketch';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-accept-'));

  cpSync(join(__dirname, '__fixtures__'), target, { recursive: true });

  return target;
};

const productOf = (target: string) =>
  resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });

const editedHero = () => {
  const target = acme();
  const productDir = join(target, DESIGN_DIR, 'acme');

  recordMerged({ product: { dir: productDir, base: null }, parts: ['elements/hero'] });
  writeFileSync(join(productDir, 'elements/hero/hero.css'), '.acme-hero { padding: 0; }');

  return { target, productDir };
};

const accept = (target: string, argv: string[]) => designAccept({ target, argv, invocation: 'et design' });

const FULL = ['elements/hero', '--product', 'acme', '--by', 'claude-opus-5-5', '--note', 'Tom approved the cleanup'];

describe('designAccept', () => {
  afterEach(() => vi.restoreAllMocks());

  it('records the hash and logs who accepted, so the change no longer shows', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const { target, productDir } = editedHero();

    expect(changedOutsideSketchOf(productOf(target))).toEqual(['elements/hero']);
    expect(accept(target, FULL)).toBe(0);
    expect(changedOutsideSketchOf(productOf(target))).toEqual([]);
    expect(readAccepted(productDir)).toEqual([
      expect.objectContaining({ part: 'elements/hero', by: 'claude-opus-5-5', note: 'Tom approved the cleanup' }),
    ]);
  });

  it('refuses a part with no change outside a sketch, and writes nothing', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const target = acme();
    const productDir = join(target, DESIGN_DIR, 'acme');

    recordMerged({ product: { dir: productDir, base: null }, parts: ['elements/hero'] });

    expect(accept(target, FULL)).toBe(1);
    expect(existsSync(join(productDir, ACCEPTED_FILE))).toBe(false);
  });

  it('refuses an unknown part and a part with an open sketch', () => {
    const errors: string[] = [];

    vi.spyOn(console, 'error').mockImplementation((line: unknown) => void errors.push(String(line)));

    const { target, productDir } = editedHero();

    expect(accept(target, ['elements/nope', ...FULL.slice(1)])).toBe(1);

    createSketch({ product: productOf(target), sketch: { layer: 'elements', name: 'hero' }, variants: ['a', 'b'] });

    expect(accept(target, FULL)).toBe(1);
    expect(errors).toEqual([expect.stringMatching(/NO PART/), expect.stringMatching(/open sketch/)]);
    expect(existsSync(join(productDir, ACCEPTED_FILE))).toBe(false);
  });

  it('refuses a missing --by or --note', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const { target, productDir } = editedHero();

    expect(accept(target, ['elements/hero', '--product', 'acme', '--note', 'why'])).toBe(2);
    expect(accept(target, ['elements/hero', '--product', 'acme', '--by', 'claude-opus-5-5'])).toBe(2);
    expect(readFileSync(join(productDir, 'merged.json'), 'utf8')).toContain('elements/hero');
    expect(changedOutsideSketchOf(productOf(target))).toEqual(['elements/hero']);
  });
});
