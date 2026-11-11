import { cpSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../design-config';
import { resolveProduct } from '../resolve-product';
import { createSketch, listSketches, parseTarget, type Sketch } from './sketch';

const removedOnScan = new Set<string>();

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();

  return {
    ...actual,
    readdirSync: (...readArgs: Parameters<typeof actual.readdirSync>) => {
      const dir = resolve(String(readArgs[0]));

      if (removedOnScan.delete(dir)) actual.rmSync(dir, { recursive: true, force: true });

      return actual.readdirSync(...readArgs);
    },
  };
});

const open = (target: string, sketch: string) => {
  const parsed = parseTarget(sketch);

  if (typeof parsed === 'string') throw new Error(parsed);

  const created = createSketch({
    product: resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} }),
    sketch: parsed,
    variants: ['a', 'b'],
  });

  if (typeof created === 'string') throw new Error(created);

  return created;
};

describe('listSketches while a merge removes a sketch folder', () => {
  it('skips a folder removed after the listing found it', () => {
    const target = mkdtempSync(join(tmpdir(), 'cli-design-sketch-vanished-'));

    cpSync(join(__dirname, '..', '__fixtures__'), target, { recursive: true });

    const productDir = join(target, DESIGN_DIR, 'acme');

    open(target, 'elements/hero');
    open(target, 'elements/card');
    removedOnScan.add(resolve(productDir, 'sketches/elements-card'));

    const listed = listSketches({ productDir, product: 'acme' });

    expect(listed.map((entry) => (entry as Sketch).target)).toEqual(['elements/hero']);
    rmSync(target, { recursive: true, force: true });
  });
});
