import { cpSync, mkdtempSync, writeFileSync } from 'fs';
import { IncomingMessage } from 'http';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { readConfig } from './design-config';
import { sketchesAnswer } from './studio-api';
import { commitAll, initGitRepo } from './system/git-repo.fixtures';
import { resolveProduct } from './system/resolve-product';
import { openEditSketch } from './system/sketch/edit-sketch';
import { recordMerged } from './system/sketch/merged-parts';

const HERO = 'elements/hero';

const statusOfEditSketch = async (target: string) => {
  const answer = await sketchesAnswer({
    target,
    url: new URL('http://localhost/__design/sketches?product=acme&targets=no'),
    request: { method: 'GET' } as IncomingMessage,
    load: () => Promise.reject(new Error('no load')),
  });

  return (answer.body as { sketches: { target: string; status: string }[] }).sketches.find(
    (sketch) => sketch.target === `${HERO}@edit`,
  )?.status;
};

describe('the sketch listing of a direct edit', () => {
  it('lists the edit sketch of an uncommitted edit as in progress, and as ready once the edit is committed', async () => {
    const target = mkdtempSync(join(tmpdir(), 'cli-edit-pick-'));

    cpSync(join(__dirname, 'system/__fixtures__'), target, { recursive: true });
    writeFileSync(join(target, '.prettierrc'), '{ "singleQuote": true }');

    const product = resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });

    recordMerged({ product, parts: [HERO] });
    initGitRepo(target, 'base');
    writeFileSync(join(product.dir, HERO, 'hero.css'), '.acme-hero { padding: 0; }\n');

    expect(await openEditSketch({ target, product, part: HERO })).toMatchObject({ status: 'ready' });
    expect(await statusOfEditSketch(target)).toBe('in progress');

    commitAll(target, 'edit');

    expect(await statusOfEditSketch(target)).toBe('ready');
  });
});
