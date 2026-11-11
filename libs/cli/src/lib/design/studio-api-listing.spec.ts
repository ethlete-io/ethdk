import { cpSync, mkdtempSync } from 'fs';
import { IncomingMessage } from 'http';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { readConfig } from './design-config';
import { PictureOf } from './merge-compare';
import { detachRunningListings, sketchesAnswer } from './studio-api';
import { encodePng } from './system/part-compare';
import { resolveProduct } from './system/resolve-product';
import { createSketch, markSketchReady, parseTarget } from './system/sketch/sketch';
import { CheckSketches, openSketchListingAt } from './system/sketch/sketch-checker';

type Listed = {
  sketches: {
    target: string;
    targets?: { variant: string; unchanged?: string[]; crops?: Record<string, { box: unknown }> }[];
  }[];
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

const listing = async (
  target: string,
  query: string,
  load: (id: string) => Promise<unknown>,
  asked: Partial<Parameters<typeof sketchesAnswer>[0]> = {},
) => {
  const answer = await sketchesAnswer({
    target,
    url: new URL(`http://localhost/__design/sketches?product=acme${query}`),
    request: { method: 'GET' } as IncomingMessage,
    load: ({ file }) => load(file),
    checkSketches,
    ...asked,
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

  it('lists where each changed state differs, in the full and in the quick listing', async () => {
    const target = acme();
    const load = async (file: string) => ({
      default: { note: 'n', states: { one: {} }, render: () => ({ body: file.includes('sketch') ? 'y' : 'x' }) },
    });
    const blank = Buffer.alloc(20 * 10 * 4, 255);
    const marked = Buffer.from(blank);

    marked.fill(0, (2 * 20 + 3) * 4, (2 * 20 + 3) * 4 + 3);

    const pictureOf: PictureOf = async ({ sketch }) => ({
      png: encodePng({ width: 20, height: 10, data: sketch ? marked : blank }),
      marks: [],
    });
    const boxesOf = (listed: Listed) => listed.sketches[0]?.targets?.map(({ crops }) => crops?.['one']?.box);
    const box = { x: 3, y: 2, width: 1, height: 1 };

    expect(boxesOf(await listing(target, '', load, { pictureOf }))).toEqual([box, box]);
    expect(boxesOf(await listing(target, '&unchanged=no', load, { pictureOf }))).toEqual([box, box]);
  });

  it('lists a variant that draws no changed state as a NO-CHANGED-STATE problem of the sketch', async () => {
    const target = mkdtempSync(join(tmpdir(), 'cli-studio-listing-'));

    cpSync(join(__dirname, 'system/__fixtures__'), target, { recursive: true });

    const product = resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });
    const parsed = parseTarget('components/card');

    if (typeof parsed === 'string') throw new Error(parsed);

    createSketch({ product, sketch: parsed, variants: ['a', 'b'] });

    const load = async (file: string) => ({
      default: { note: 'n', states: { one: {} }, render: () => ({ body: file.includes('/b/') ? 'y' : 'x' }) },
    });
    const listed = (await listing(target, '', load)) as unknown as {
      sketches: { problems?: { variant: string; problems: { rule: string; message: string }[] }[] }[];
    };

    expect(
      listed.sketches[0]?.problems?.map(({ variant, problems }) => ({
        variant,
        rules: problems.map(({ rule, message }) => `${rule}: ${message}`),
      })),
    ).toEqual(
      expect.arrayContaining([
        {
          variant: 'a',
          rules: expect.arrayContaining([
            'NO-CHANGED-STATE: variant a of components/card draws no state that differs from the design - draw the state the sketch is about (for a marker sketch: draw the missing state)',
          ]),
        },
        { variant: 'b', rules: expect.not.arrayContaining([expect.stringContaining('NO-CHANGED-STATE')]) },
      ]),
    );
  });

  it('starts a new listing after a file change instead of joining one that started before it', async () => {
    const target = acme();
    let release = () => undefined as void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const load = async () => {
      await gate;

      return { default: { note: 'n', states: { one: {} }, render: () => ({ body: 'x' }) } };
    };
    const targetsOf = (listed: Listed) => listed.sketches.map((sketch) => sketch.target);
    const earlier = listing(target, '', load);
    const product = resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });
    const parsed = parseTarget('components/chip');

    if (typeof parsed === 'string') throw new Error(parsed);

    const created = createSketch({ product, sketch: parsed, variants: ['a'] });

    if (typeof created === 'string') throw new Error(created);

    markSketchReady({ checkout: target, sketch: created });
    detachRunningListings();

    const later = listing(target, '', load);

    release();

    expect(targetsOf(await earlier)).toEqual(['components/card']);
    expect(targetsOf(await later)).toEqual(['components/card', 'components/chip']);
  });
});

describe('the first full sketch listing', () => {
  const drawn = { default: { note: 'n', states: { one: {} }, render: () => ({ body: 'x' }) } };

  it('loads the targets while the sketch check still runs', async () => {
    const target = acme();
    let loaded = () => undefined as void;
    const firstLoad = new Promise<void>((resolve) => (loaded = resolve));
    const checkAfterALoad: CheckSketches = async (request) => {
      await firstLoad;

      return checkSketches(request);
    };
    const listed = await listing(
      target,
      '',
      async () => {
        loaded();

        return drawn;
      },
      { checkSketches: checkAfterALoad },
    );

    expect(listed.sketches[0]?.targets?.map(({ variant }) => variant)).toEqual(['a', 'b']);
  });

  it('loads the variants of a target side by side and keeps their order', async () => {
    const target = acme();
    let bLoaded = () => undefined as void;
    const bAsked = new Promise<void>((resolve) => (bLoaded = resolve));
    const listed = await listing(target, '', async (file) => {
      if (file.includes('/b/')) bLoaded();
      if (file.includes('/a/')) await bAsked;

      return drawn;
    });

    expect(listed.sketches[0]?.targets?.map(({ variant }) => variant)).toEqual(['a', 'b']);
  });

  it('warms the renderer when a full listing will draw pictures, and not for a light one', async () => {
    const target = acme();
    const warmRenderer = vi.fn();
    const pictureOf = () => new Promise<never>(() => undefined);

    await listing(target, '&unchanged=no&targets=no', async () => drawn, { pictureOf, warmRenderer });
    expect(warmRenderer).not.toHaveBeenCalled();

    void listing(target, '', () => new Promise(() => undefined), { pictureOf, warmRenderer });
    await vi.waitFor(() => expect(warmRenderer).toHaveBeenCalledTimes(1));
  });
});
