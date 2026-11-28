import { cpSync, mkdtempSync, writeFileSync } from 'fs';
import { IncomingMessage } from 'http';
import { tmpdir } from 'os';
import { join } from 'path';
import { Readable } from 'stream';
import { describe, expect, it } from 'vitest';
import { calibrationMs, recordPerf, watchLongestBlock } from '../../perf.fixtures';
import { readConfig } from '../../design-config';
import { sketchDecisionAnswer } from '../../studio-api';
import { resolveProduct } from '../resolve-product';
import { createSketch, markSketchReady, Sketch } from './sketch';

const readyPickedSketch = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-merge-perf-'));

  cpSync(join(__dirname, '..', '__fixtures__'), target, { recursive: true });
  writeFileSync(join(target, '.prettierrc'), '{ "singleQuote": true }');

  const product = resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });
  const created = createSketch({
    product,
    sketch: { layer: 'elements', name: 'hero' },
    variants: ['a', 'b'],
  }) as Sketch;
  markSketchReady({ checkout: target, sketch: created });

  return target;
};

describe('mergeSketch perf', { timeout: 60_000 }, () => {
  it('keeps the server thread answering while a Studio merge runs: no stall over 3 calibration units', async () => {
    const target = readyPickedSketch();
    const unitBefore = calibrationMs();
    const stop = watchLongestBlock();

    const answer = await sketchDecisionAnswer({
      target,
      url: new URL('http://localhost/?product=acme&sketch=elements/hero'),
      request: Object.assign(Readable.from([JSON.stringify({ kind: 'pick', variant: 'b' })]), {
        method: 'POST',
      }) as unknown as IncomingMessage,
    });

    const { longestMs, gc } = stop();
    const unitMs = Math.max(unitBefore, calibrationMs());
    const boundMs = unitMs * 3;

    recordPerf('merge-stall', { longestMs, boundMs, unitMs, gc });

    expect(answer.status).toBe(200);
    expect(longestMs).toBeLessThan(boundMs);
  });
});
