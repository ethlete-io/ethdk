import { cpSync, mkdtempSync, readFileSync } from 'fs';
import { IncomingMessage } from 'http';
import { tmpdir } from 'os';
import { join } from 'path';
import { Readable } from 'stream';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from './design-config';
import { SKETCH_DECISION_PATH, sketchDecisionAnswer } from './studio-api';
import { resolveProduct } from './system/resolve-product';
import { createSketch, markSketchReady, parseTarget } from './system/sketch/sketch';

describe('the Studio pick route', () => {
  it('writes the pick with by, cmd and pid', async () => {
    const target = mkdtempSync(join(tmpdir(), 'cli-studio-pick-'));

    cpSync(join(__dirname, 'system/__fixtures__'), target, { recursive: true });

    const product = resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });
    const parsed = parseTarget('elements/hero');

    if (typeof parsed === 'string') throw new Error(parsed);

    const created = createSketch({ product, sketch: parsed, variants: ['a', 'b'] });

    if (typeof created === 'string') throw new Error(created);

    markSketchReady({ checkout: target, sketch: created });

    const answer = await sketchDecisionAnswer({
      target,
      url: new URL('http://localhost/?product=acme&sketch=elements/hero'),
      request: Object.assign(Readable.from([JSON.stringify({ kind: 'pick', variant: 'b' })]), {
        method: 'POST',
      }) as unknown as IncomingMessage,
      signal: new AbortController().signal,
    });

    expect(answer.status).toBe(200);

    const written = JSON.parse(
      readFileSync(join(target, DESIGN_DIR, 'acme/sketches/elements-hero/sketch.json'), 'utf8'),
    ) as { decision: unknown };

    expect(written.decision).toEqual({
      kind: 'pick',
      variant: 'b',
      by: 'designer',
      cmd: `POST ${SKETCH_DECISION_PATH}`,
      pid: process.pid,
      decidedAt: expect.any(String),
    });
  });
});
