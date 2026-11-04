import { cpSync, mkdtempSync } from 'fs';
import { IncomingMessage } from 'http';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { readConfig } from './paths';
import { sketchesAnswer } from './studio-api';
import { resolveProduct } from './system/resolve-product';
import { createSketch, markSketchReady, parseTarget } from './system/sketch/sketch';
import { CheckSketches, openSketchListingAt } from './system/sketch/sketch-checker';

type Listed = {
  sketches: { target: string; targets?: { variant: string; unchanged?: string[] }[] }[];
};

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-studio-listing-'));

  cpSync(join(__dirname, 'system/__fixtures__'), target, { recursive: true });

  const product = resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });
  const parsed = parseTarget('components/card');
  const created = typeof parsed === 'string' ? parsed : createSketch({ product, sketch: parsed, variants: ['a', 'b'] });

  if (typeof created === 'string') throw new Error(created);

  markSketchReady({ checkout: target, sketch: created });

  return target;
};

const checkSketches: CheckSketches = async (request) => {
  const listing = openSketchListingAt(request);

  if (typeof listing === 'string') throw new Error(listing);

  return listing;
};

const listing = async (target: string, query: string, load: (id: string) => Promise<unknown>) => {
  const answer = await sketchesAnswer({
    target,
    url: new URL(`http://localhost/__design/sketches?product=acme${query}`),
    request: { method: 'GET' } as IncomingMessage,
    load: ({ file }) => load(file),
    checkSketches,
  });

  return answer.body as Listed;
};

describe('the sketch listing tiers', () => {
  it('lists the sketches without targets and without loading a part module while every module load hangs', async () => {
    const target = acme();
    const listed = await listing(target, '&unchanged=no&targets=no', () => new Promise(() => undefined));

    expect(listed.sketches.map(({ target, targets }) => ({ target, targets }))).toEqual([
      { target: 'components/card', targets: undefined },
    ]);
  });

  it('answers the quick listing with the unchanged states a full listing compared, and none before', async () => {
    const target = acme();
    const load = async () => ({ default: { note: 'n', states: { one: {} }, render: () => ({ body: 'x' }) } });
    const unchangedOf = (listed: Listed) => listed.sketches[0]?.targets?.map(({ unchanged }) => unchanged);

    expect(unchangedOf(await listing(target, '&unchanged=no', load))).toEqual([undefined, undefined]);
    expect(unchangedOf(await listing(target, '', load))).toEqual([['one'], ['one']]);
    expect(unchangedOf(await listing(target, '&unchanged=no', load))).toEqual([['one'], ['one']]);
  });
});
