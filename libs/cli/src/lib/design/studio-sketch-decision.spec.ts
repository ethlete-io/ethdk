import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { IncomingMessage } from 'http';
import { tmpdir } from 'os';
import { join } from 'path';
import { Readable } from 'stream';
import { describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR, readConfig } from './design-config';
import { sketchDecisionAnswer } from './studio-api';
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
});
