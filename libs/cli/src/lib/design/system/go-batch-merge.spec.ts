import { cpSync, existsSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readConfig } from '../paths';
import { goBatch } from './go-batch';
import { resolveProduct } from './resolve-product';
import { createSketch, markSketchReady, Sketch } from './sketch/sketch';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-batch-merge-'));

  cpSync(join(__dirname, '__fixtures__'), target, { recursive: true });
  writeFileSync(join(target, '.prettierrc'), '{ "singleQuote": true }');

  return target;
};

const productOf = (target: string) =>
  resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });

const output = () => {
  const lines: string[] = [];
  const push = (line: unknown) => void lines.push(String(line));

  vi.spyOn(console, 'log').mockImplementation(push);
  vi.spyOn(console, 'error').mockImplementation(push);
  vi.spyOn(console, 'warn').mockImplementation(push);

  return lines;
};

const run = (target: string, entries: unknown[]) => {
  const list = join(target, 'go-list.json');
  const asked: string[] = [];

  writeFileSync(list, JSON.stringify(entries));

  return {
    asked,
    go: () =>
      goBatch({
        target,
        file: list,
        invocation: 'et design',
        prompt: {
          isTTY: true,
          ask: async (question) => {
            asked.push(question);

            return 'y';
          },
        },
      }),
  };
};

describe('design go --batch with a merge entry', () => {
  afterEach(() => vi.restoreAllMocks());

  it('refuses the whole list before it asks when a sketch is in progress, and names the ready command', async () => {
    const target = acme();
    const lines = output();
    const product = productOf(target);

    createSketch({ product, sketch: { layer: 'elements', name: 'hero' }, variants: ['a'] });

    const batch = run(target, [
      { part: 'elements/hero', product: 'acme', action: 'merge', variant: 'a', note: 'Impl Q9' },
      { part: 'elements/nothing', product: 'acme', action: 'merge', note: 'Impl Q9' },
      { part: 'elements/hero', product: 'ghost', action: 'merge', note: 'Impl Q9' },
    ]);

    expect(await batch.go()).toBe(1);
    expect(batch.asked).toEqual([]);
    expect(lines.join('\n')).toContain(
      'merge elements/hero: elements/hero is in progress - mark it ready first: design sketch ready elements/hero --by <model id> --product acme',
    );
    expect(lines.join('\n')).toContain('no sketch on elements/nothing in acme');
    expect(lines.join('\n')).toContain('nothing recorded - fix the go list');
    expect(existsSync(join(product.dir, 'sketches'))).toBe(true);
  });

  it('merges a ready sketch as Tom after one yes', async () => {
    const target = acme();
    const lines = output();
    const product = productOf(target);
    const created = createSketch({
      product,
      sketch: { layer: 'elements', name: 'hero' },
      variants: ['a'],
    }) as Sketch;

    markSketchReady({ checkout: target, sketch: created });

    const batch = run(target, [
      { part: 'elements/hero', product: 'acme', action: 'merge', variant: 'a', note: 'Impl Q9' },
    ]);

    expect(await batch.go()).toBe(0);
    expect(batch.asked).toEqual(['Record this as Tom? [y/N] ']);
    expect(lines.join('\n')).toContain('  merge acme elements/hero variant a - Impl Q9');
    expect(lines.join('\n')).toContain('merged elements/hero variant a into acme');
  });
});
