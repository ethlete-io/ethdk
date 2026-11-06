import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from './paths';
import { registrySliceOf } from './serve';
import { resolveProduct } from './system/resolve-product';
import { createServedHashes, ServedRequest, withRegistrySlices } from './system/served-cache';
import { createSketch, markSketchReady, parseTarget, Sketch } from './system/sketch/sketch';
import { createSystemModules } from './system/system-modules';

const targets: string[] = [];

afterEach(() => {
  for (const target of targets.splice(0)) rmSync(target, { recursive: true, force: true });
});

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-registry-slice-'));

  cpSync(join(__dirname, 'system/__fixtures__'), target, { recursive: true });
  targets.push(target);

  return target;
};

const readySketch = (target: string, part: string, variants: string[]) => {
  const product = resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });
  const parsed = parseTarget(part);
  const created = typeof parsed === 'string' ? parsed : createSketch({ product, sketch: parsed, variants });

  if (typeof created === 'string') throw new Error(created);

  return markSketchReady({ checkout: target, sketch: created }) as Sketch;
};

const FRAMES = {
  card: 'product=acme&part=components/card&state=default',
  button: 'product=acme&part=components/button&state=default',
  cardSketch: 'product=acme&part=components/card&state=default&sketch=components/card&variant=b',
  heroSketch: 'product=acme&part=elements/hero&state=default&sketch=elements/hero&variant=b',
};

/** What each frame of `FRAMES` reads from the registries, as a freshly started server would serve it. */
const slicesOf = (target: string) => {
  const config = readConfig(target) ?? {};
  const system = createSystemModules({ target, config });

  return Object.fromEntries(
    Object.entries(FRAMES).map(([name, query]) => [
      name,
      registrySliceOf({ target, config, system, query: new URLSearchParams(query) }),
    ]),
  ) as Record<keyof typeof FRAMES, string>;
};

describe('the registry slice of a frame', () => {
  it("holds the frame's own product and sketch entries", () => {
    const target = acme();

    readySketch(target, 'components/card', ['a', 'b']);

    const slices = slicesOf(target);

    expect(slices.card).toMatch(
      /"components\/card": \(\) => import\("[^"]*acme-base\/components\/card\/card\.ts\?design-product=acme"\)/,
    );
    expect(slices.card).not.toContain('design-sketch');
    expect(slices.cardSketch).toMatch(
      /sketch \{"target":"components\/card","variant":"b"\} true\n[^]*components-card\/b\/components\/card\/card\.ts\?design-product=acme&design-sketch=components%2Fcard&design-variant=b/,
    );
  });

  it("stays the same through a check run's own writes, though the whole registry changes", () => {
    const target = acme();
    const productDir = join(target, DESIGN_DIR, 'acme');

    readySketch(target, 'components/card', ['a', 'b']);

    const config = readConfig(target) ?? {};
    const wholeOf = () => {
      const system = createSystemModules({ target, config });

      return system.sketchesOf('acme').map(({ target: part, variants }) => `${part} ${variants.join(',')}`);
    };
    const before = slicesOf(target);
    const wholeBefore = wholeOf();

    readySketch(target, 'elements/hero@edit', ['old', 'new']);
    writeFileSync(join(productDir, 'merged.json'), JSON.stringify({ at: Date.now() }));
    writeFileSync(join(productDir, 'ready.json'), JSON.stringify({ at: Date.now() }));
    writeFileSync(join(productDir, 'pictures.json'), JSON.stringify({ at: Date.now() }));

    expect(wholeOf()).not.toEqual(wholeBefore);
    expect(slicesOf(target)).toEqual(before);
  });

  it('changes only for the frames that draw the sketch whose parts changed', () => {
    const target = acme();

    readySketch(target, 'components/card', ['a', 'b']);
    readySketch(target, 'elements/hero', ['a', 'b']);

    const before = slicesOf(target);
    const card = join(target, DESIGN_DIR, 'acme/sketches/components-card/b/components/card/card.ts');
    const button = join(target, DESIGN_DIR, 'acme/sketches/components-card/b/components/button/button.ts');

    mkdirSync(join(button, '..'), { recursive: true });
    writeFileSync(button, readFileSync(card, 'utf8'));

    const after = slicesOf(target);

    expect(after.cardSketch).not.toBe(before.cardSketch);
    expect({ ...after, cardSketch: '' }).toEqual({ ...before, cardSketch: '' });
  });
});

describe('the requests a cache entry is keyed on', () => {
  const base = 'http://[::1]:5173';
  const request = (url: string) => ({ url: `${base}${url}`, accept: null });

  it('swap the env and system registries for the slice of each frame', () => {
    const keyed = withRegistrySlices([
      request(`/frame.html?${FRAMES.cardSketch}&interaction=hover`),
      request(`/frame.html?${FRAMES.cardSketch}`),
      request('/@id/__x00__virtual:design-explore/env'),
      request('/@id/__x00__virtual:design-explore/system'),
      request('/@id/__x00__virtual:design-explore'),
    ]).map(({ url }) => url);

    expect(keyed).toEqual([
      `${base}/frame.html?${FRAMES.cardSketch}&interaction=hover`,
      `${base}/frame.html?${FRAMES.cardSketch}`,
      `${base}/@id/__x00__virtual:design-explore`,
      `${base}/__design/registry-slice?product=acme&sketch=components%2Fcard&variant=b`,
      `${base}/__design/registry-slice?product=acme&sketch=components%2Fcard&variant=b`,
    ]);
  });

  it('keep the registries when no frame was requested', () => {
    const requested = [request('/@id/__x00__virtual:design-explore/system')];

    expect(withRegistrySlices(requested)).toEqual(requested);
  });
});

describe('the hash of an SDK render', () => {
  const markup = (first: number, label: string) =>
    JSON.stringify({
      markup: `<et-radio-group aria-labelledby="et-label-${first}"><et-label id="et-label-${first}">${label}</et-label><et-radio aria-labelledby="et-selection-option-label-${first + 10}"><span id="et-selection-option-label-${first + 10}">Free</span></et-radio></et-radio-group>`,
    });
  const hashedAfter = async (url: string, answers: string[]) => {
    const request: ServedRequest = { url, accept: null, post: '{"template":"<et-radio-group />"}' };
    const served = (answer: string) =>
      createServedHashes('http://[::1]:5173', async () => ({ body: Buffer.from(answer), lines: [] }));
    const [input] = await served(answers[0] ?? '').inputsOf([request]);

    return served(answers[1] ?? '').unchanged(input ? [input] : []);
  };

  it('ignores the counters the render worker numbers SDK ids with', async () => {
    expect(await hashedAfter('/__design/render', [markup(30, 'Plan'), markup(33, 'Plan')])).toBe(true);
  });

  it('still sees a changed render, and counters outside a render', async () => {
    expect(await hashedAfter('/__design/render', [markup(30, 'Plan'), markup(33, 'Plans')])).toBe(false);
    expect(await hashedAfter('/part.ts', [markup(30, 'Plan'), markup(33, 'Plan')])).toBe(false);
  });
});
