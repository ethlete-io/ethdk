import { cpSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readConfig } from '../../design-config';
import { resolveProduct } from '../resolve-product';
import { mergeStepOf } from './merge-step';
import { createSketch, markSketchReady, Sketch } from './sketch';

const readySketch = (sketch?: string) => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-edit-merge-'));

  cpSync(join(__dirname, '..', '__fixtures__'), target, { recursive: true });

  const product = resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });
  const created = createSketch({
    product,
    sketch: { layer: 'elements', name: 'hero', sketch },
    variants: ['new', 'old'],
  }) as Sketch;

  markSketchReady({ checkout: target, sketch: created });

  return target;
};

const stepOf = (options: { target: string; part: string; note: string }) =>
  mergeStepOf({ ...options, product: 'acme', variant: 'old', by: 'claude-opus-5-5' });

describe('mergeStepOf on a sketch with two live variants', () => {
  afterEach(() => vi.restoreAllMocks());

  it('merges the named variant of an @edit sketch when --allowed-by holds a ref', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const step = stepOf({ target: readySketch('edit'), part: 'elements/hero@edit', note: 'Impl Q12' });

    expect(typeof step).toBe('object');
    expect(await (step as Exclude<typeof step, string>).run()).toBe(0);
  });

  it('refuses an @edit sketch without a ref', () => {
    expect(stepOf({ target: readySketch('edit'), part: 'elements/hero@edit', note: 'Tom said so' })).toContain(
      'the user picks in Studio',
    );
  });

  it('refuses a sketch that is not @edit, even with a ref', () => {
    expect(stepOf({ target: readySketch(), part: 'elements/hero', note: 'Impl Q12' })).toContain(
      'the user picks in Studio',
    );
  });
});
