import { cpSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { readConfig } from '../../design-config';
import { commitAll, initGitRepo } from '../git-repo.fixtures';
import { gitTopOf } from '../../git-top';
import { partKeyOf, resolveProduct } from '../resolve-product';
import { headHoldsPart, tracksFileBelow, withHeadSnapshot } from './edit-sketch';

const spawns = vi.hoisted(() => ({ count: 0 }));

vi.mock('child_process', async (importOriginal) => {
  const original = await importOriginal<typeof import('child_process')>();

  return {
    ...original,
    execFileSync: ((...args: Parameters<typeof original.execFileSync>) => {
      if (args[0] === 'git') spawns.count++;

      return original.execFileSync(...args);
    }) as typeof original.execFileSync,
  };
});

const repo = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-head-snapshot-'));

  cpSync(join(__dirname, '..', '__fixtures__'), target, { recursive: true });
  initGitRepo(target, 'base');

  return {
    target,
    product: resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} }),
  };
};

describe('git reads of a listing', () => {
  it('answers headHoldsPart for every part from a constant number of git calls, like the call per part', () => {
    const { target, product } = repo();
    const dirty = product.parts[0];

    writeFileSync(join(target, 'untracked-before.txt'), 'x');
    commitAll(target, 'more');
    writeFileSync(dirty?.file ?? '', `${'// edited\n'}`);

    const perPart = product.parts.map((part) => [partKeyOf(part), headHoldsPart(product, part)]);

    spawns.count = 0;
    product.parts.forEach((part) => headHoldsPart(product, part));
    const unbatched = spawns.count;

    spawns.count = 0;

    const batched = withHeadSnapshot(() =>
      product.parts.map((part) => [partKeyOf(part), headHoldsPart(product, part)]),
    );

    expect(product.parts.length).toBeGreaterThan(3);
    expect(unbatched).toBeGreaterThanOrEqual(product.parts.length);
    expect(spawns.count).toBeLessThanOrEqual(2);
    expect(batched).toEqual(perPart);
    expect(perPart.some(([, holds]) => holds === false)).toBe(true);
    expect(perPart.some(([, holds]) => holds === true)).toBe(true);

    spawns.count = 0;
    withHeadSnapshot(() => product.parts.forEach((part) => tracksFileBelow(product, part.file)));
    expect(spawns.count).toBeLessThanOrEqual(2);
  });

  it('asks git for the repository root once per folder', () => {
    const { product } = repo();

    spawns.count = 0;
    for (let index = 0; index < 10; index++) gitTopOf(product.dir);

    expect(spawns.count).toBe(1);
  });
});
