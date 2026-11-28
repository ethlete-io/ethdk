import { cpSync, existsSync, mkdtempSync } from 'fs';
import { IncomingMessage } from 'http';
import { tmpdir } from 'os';
import { join } from 'path';
import { Readable } from 'stream';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from './design-config';
import { sketchDiscardAnswer } from './studio-api';
import { resolveProduct } from './system/resolve-product';
import { createSketch, markSketchReady, parseTarget } from './system/sketch/sketch';

const withSketch = (id: string) => {
  const target = mkdtempSync(join(tmpdir(), 'cli-studio-discard-'));

  cpSync(join(__dirname, 'system/__fixtures__'), target, { recursive: true });

  const product = resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });
  const parsed = parseTarget(id);

  if (typeof parsed === 'string') throw new Error(parsed);

  const created = createSketch({ product, sketch: parsed, variants: ['old', 'new'] });

  if (typeof created === 'string') throw new Error(created);

  markSketchReady({ checkout: target, sketch: created });

  return { target, dir: created.dir };
};

const discard = (target: string, id: string) =>
  sketchDiscardAnswer({
    target,
    url: new URL(`http://localhost/?product=acme&sketch=${encodeURIComponent(id)}`),
    request: Object.assign(Readable.from([]), { method: 'POST' }) as unknown as IncomingMessage,
    signal: new AbortController().signal,
  });

describe('the Studio discard route', () => {
  it('refuses the old/new sketch of a direct edit and keeps it', async () => {
    const { target, dir } = withSketch('elements/hero@edit');

    expect(await discard(target, 'elements/hero@edit')).toMatchObject({
      status: 422,
      body: {
        reason: 'edit-discard-refused',
        error: expect.stringMatching(/^EDIT-DISCARD-REFUSED: elements\/hero@edit /u),
      },
    });
    expect(existsSync(dir)).toBe(true);
  });

  it('discards any other sketch', async () => {
    const { target, dir } = withSketch('elements/hero');

    expect(await discard(target, 'elements/hero')).toMatchObject({
      status: 200,
      body: { discarded: 'elements/hero' },
    });
    expect(existsSync(dir)).toBe(false);
    expect(existsSync(join(target, DESIGN_DIR, 'acme/sketches/elements-hero'))).toBe(false);
  });
});
