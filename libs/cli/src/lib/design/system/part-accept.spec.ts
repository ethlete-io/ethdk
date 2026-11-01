import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { IncomingMessage } from 'http';
import { tmpdir } from 'os';
import { join } from 'path';
import { Readable } from 'stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR, readConfig } from '../paths';
import { openPointsAnswer, partAcceptAnswer } from '../studio-api';
import { DrawStates } from './accepted-pictures';
import { readyPartOf } from './part-ready';
import { resolveProduct } from './resolve-product';
import { ACCEPTED_FILE, changedOutsideSketchOf, readAccepted, recordMerged } from './sketch/merged-parts';
import { createSketch } from './sketch/sketch';

const HERO = 'elements/hero';

const productOf = (target: string) =>
  resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });

const editedHero = (edit = (source: string) => `${source}// edited\n`) => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-part-accept-'));
  const productDir = join(target, DESIGN_DIR, 'acme');
  const file = join(productDir, HERO, 'hero.ts');

  cpSync(join(__dirname, '__fixtures__'), target, { recursive: true });
  recordMerged({ product: { dir: productDir, base: null }, parts: [HERO] });
  writeFileSync(file, edit(readFileSync(file, 'utf8')));

  return { target, productDir };
};

const hashOf = (target: string) => {
  const located = readyPartOf({ product: productOf(target), part: HERO });

  return typeof located === 'string' ? located : located.hash;
};

const request = (method: string, body?: unknown) =>
  Object.assign(Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]), {
    method,
  }) as unknown as IncomingMessage;

const drawStates: DrawStates = async ({ parts }) => new Map(parts.map((part) => [part, { default: 'a1' }]));

const post = (target: string, body: unknown) =>
  partAcceptAnswer({
    target,
    url: new URL('http://localhost/?product=acme'),
    request: request('POST', body),
    drawStates,
  });

describe('part accept', () => {
  afterEach(() => vi.restoreAllMocks());

  it('accepts a direct edit at the hash Studio showed, as the Studio user', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const { target, productDir } = editedHero();
    const shown = await openPointsAnswer({
      target,
      url: new URL(`http://localhost/?product=acme&part=${HERO}`),
      request: request('GET'),
    });

    expect(shown.body).toMatchObject({ directEdit: true });
    expect(await post(target, { part: HERO, hash: hashOf(target) })).toMatchObject({
      status: 200,
      body: { part: HERO, accepted: { by: 'user', note: 'approved by a click in Studio' } },
    });
    expect(changedOutsideSketchOf(productOf(target))).toEqual([]);
    expect(readAccepted(productDir)).toEqual([
      expect.objectContaining({ part: HERO, by: 'user', note: 'approved by a click in Studio' }),
    ]);
  });

  it('refuses before it writes: no hash, a stale hash, an unknown part, nothing to accept, an open sketch', async () => {
    const { target, productDir } = editedHero();
    const hash = hashOf(target);

    expect(await post(target, { part: HERO })).toMatchObject({ status: 400, body: { reason: 'hash-missing' } });
    expect(await post(target, { part: HERO, hash: 'stale' })).toMatchObject({
      status: 409,
      body: { reason: 'changed' },
    });
    expect(await post(target, { part: 'elements/nope', hash })).toMatchObject({
      status: 404,
      body: { reason: 'unknown-part' },
    });

    createSketch({ product: productOf(target), sketch: { layer: 'elements', name: 'hero' }, variants: ['a', 'b'] });

    expect(await post(target, { part: HERO, hash })).toMatchObject({ status: 422, body: { reason: 'open-sketch' } });

    const untouched = editedHero((source) => source);

    expect(await post(untouched.target, { part: HERO, hash: hashOf(untouched.target) })).toMatchObject({
      status: 422,
      body: { reason: 'nothing-to-accept' },
    });
    expect(existsSync(join(productDir, ACCEPTED_FILE))).toBe(false);
    expect(existsSync(join(untouched.productDir, ACCEPTED_FILE))).toBe(false);
  });

  it('refuses a part with theming findings and lists them', async () => {
    const { target, productDir } = editedHero((source) =>
      source.replace('class="acme-hero"', 'class="acme-hero bg-surface-sunken"'),
    );
    const config = readConfig(target) ?? {};

    writeFileSync(
      join(target, DESIGN_DIR, 'config.json'),
      JSON.stringify({ ...config, products: { acme: { styles: [`${DESIGN_DIR}/acme/styles.css`] } } }),
    );
    writeFileSync(
      join(productDir, 'styles.css'),
      `@import ${JSON.stringify(require.resolve('tailwindcss/index.css'))};\n`,
    );

    expect(await post(target, { part: HERO, hash: hashOf(target) })).toMatchObject({
      status: 422,
      body: { reason: 'findings', findings: [expect.stringMatching(/^CLASS-UNDEFINED/)] },
    });
    expect(existsSync(join(productDir, ACCEPTED_FILE))).toBe(false);
  });
});
