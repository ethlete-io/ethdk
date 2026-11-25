import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { IncomingMessage } from 'http';
import { tmpdir } from 'os';
import { join } from 'path';
import { Readable } from 'stream';
import { describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR, readConfig } from './design-config';
import { designSketch } from './sketch-command';
import { sketchDecisionAnswer, sketchMergeAnswer } from './studio-api';
import { resolveProduct } from './system/resolve-product';
import { createSketch, markSketchReady, parseTarget } from './system/sketch/sketch';

const readied = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-studio-pick-'));

  cpSync(join(__dirname, 'system/__fixtures__'), target, { recursive: true });

  const product = resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });
  const parsed = parseTarget('elements/hero');

  if (typeof parsed === 'string') throw new Error(parsed);

  const created = createSketch({ product, sketch: parsed, variants: ['a', 'b'] });

  if (typeof created === 'string') throw new Error(created);

  markSketchReady({ checkout: target, sketch: created });

  return { target, sketchDir: join(target, DESIGN_DIR, 'acme/sketches/elements-hero') };
};

const SLIDER = `import { definePart, drawing } from '@design-system';

export default definePart({
  note: 'Der Slider des Hero.',
  states: { rest: {} },
  describe: { rest: 'The slider at rest; check that it reads.' },
  render: () => drawing({ body: '<div class="acme-hero-slider"></div>', styles: '' }),
});
`;

const withMarkedSlider = (sketchDir: string) => {
  const file = join(sketchDir, 'sketch.json');
  const sketch = JSON.parse(readFileSync(file, 'utf8')) as { variantInfo: Record<string, object> };

  mkdirSync(join(sketchDir, 'b/components/hero-slider'), { recursive: true });
  writeFileSync(join(sketchDir, 'b/components/hero-slider/hero-slider.ts'), SLIDER);
  writeFileSync(
    file,
    JSON.stringify({
      ...sketch,
      variantInfo: { ...sketch.variantInfo, b: { ...sketch.variantInfo['b'], subParts: ['components/hero-slider'] } },
    }),
  );
};

const subSketchDirOf = (target: string) => join(target, DESIGN_DIR, 'acme/sketches/components-hero-slider');

const readJson = (file: string) => JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;

const merge = (target: string) =>
  sketchMergeAnswer({
    target,
    url: new URL('http://localhost/?product=acme&sketch=elements/hero'),
    request: Object.assign(Readable.from(['{}']), { method: 'POST' }) as unknown as IncomingMessage,
    signal: new AbortController().signal,
  });

const pick = (target: string, variant: string) =>
  sketchDecisionAnswer({
    target,
    url: new URL('http://localhost/?product=acme&sketch=elements/hero'),
    request: Object.assign(Readable.from([JSON.stringify({ kind: 'pick', variant })]), {
      method: 'POST',
    }) as unknown as IncomingMessage,
    signal: new AbortController().signal,
  });

describe('the Studio pick route', { timeout: 60_000 }, () => {
  // Decision: a pick in Studio is a merge; there is no picked-but-unmerged state.
  it('merges the picked variant at once', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const { target, sketchDir } = readied();
    const answer = await pick(target, 'b');

    expect(answer).toMatchObject({ status: 200, body: { merged: ['elements/hero'] } });
    expect(existsSync(sketchDir)).toBe(false);
    expect(JSON.parse(readFileSync(join(target, DESIGN_DIR, 'acme/merged.json'), 'utf8'))).toMatchObject({
      'elements/hero': { variant: 'b' },
    });
  });

  it('refuses a pick whose merge is refused and leaves no pick behind', async () => {
    const { target, sketchDir } = readied();
    const file = join(sketchDir, 'sketch.json');
    const sketch = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;

    writeFileSync(file, JSON.stringify({ ...sketch, baseline: undefined }));

    const before = readFileSync(file, 'utf8');
    const answer = await pick(target, 'b');

    expect(answer.status).toBe(422);
    expect(readFileSync(file, 'utf8')).toBe(before);
  });

  // Decision B726: a Studio pick of a variant with marked sub-parts opens one sketch per sub-part, seeded from the variant, and merges nothing.
  it('opens a sub-sketch per marked sub-part instead of merging', async () => {
    const { target, sketchDir } = readied();

    withMarkedSlider(sketchDir);

    const answer = await pick(target, 'b');
    const sub = subSketchDirOf(target);

    expect(answer).toMatchObject({ status: 200, body: { merged: [], subSketches: ['components/hero-slider'] } });
    expect(existsSync(join(target, DESIGN_DIR, 'acme/merged.json'))).toBe(false);
    expect(readJson(join(sketchDir, 'sketch.json'))).toMatchObject({
      decision: { kind: 'pick', variant: 'b' },
      subSketches: ['components/hero-slider'],
    });
    expect(readJson(join(sub, 'sketch.json'))).toMatchObject({
      target: 'components/hero-slider',
      parent: 'elements/hero',
      status: 'in progress',
    });
    expect(readFileSync(join(sub, 'a/components/hero-slider/hero-slider.ts'), 'utf8')).toContain('acme-hero-slider');
  });

  // Decision B726: the parent does not merge on its own while the sub-sketches its pick opened are open.
  it('refuses a merge of the parent while its sub-sketches are open', async () => {
    const { target, sketchDir } = readied();

    withMarkedSlider(sketchDir);
    await pick(target, 'b');

    const answer = await merge(target);

    expect(answer.status).toBe(422);
    expect(JSON.stringify(answer.body)).toContain('waits on its sub-sketches components/hero-slider');
    expect(existsSync(join(target, DESIGN_DIR, 'acme/merged.json'))).toBe(false);
  });

  // Decision B726: `sketch pick` in chat takes the same way as the Studio pick, so an agent cannot merge past the sub-parts.
  it('opens the sub-sketches on sketch pick', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const { target, sketchDir } = readied();

    withMarkedSlider(sketchDir);

    const code = await designSketch({
      target,
      argv: [
        'pick',
        'elements/hero',
        '--variant',
        'b',
        '--decided-by',
        'human in chat: b',
        '--product',
        'acme',
        '--by',
        'claude-opus-5-5',
      ],
      invocation: 'et design',
    });

    expect(code).toBe(0);
    expect(existsSync(join(target, DESIGN_DIR, 'acme/merged.json'))).toBe(false);
    expect(readJson(join(subSketchDirOf(target), 'sketch.json'))).toMatchObject({ parent: 'elements/hero' });
  });

  // Decision B726: a pick that would leave the sub-sketches behind is refused until slice 6 lets the pick change.
  it('refuses a pick of another variant while the sub-sketches are open', async () => {
    const { target, sketchDir } = readied();

    withMarkedSlider(sketchDir);
    await pick(target, 'b');

    const before = readFileSync(join(sketchDir, 'sketch.json'), 'utf8');
    const answer = await pick(target, 'a');

    expect(answer.status).toBe(422);
    expect(readFileSync(join(sketchDir, 'sketch.json'), 'utf8')).toBe(before);
    expect(existsSync(join(target, DESIGN_DIR, 'acme/merged.json'))).toBe(false);
  });
});
