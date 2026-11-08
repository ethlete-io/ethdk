import { cpSync, mkdtempSync, writeFileSync } from 'fs';
import { IncomingMessage } from 'http';
import { tmpdir } from 'os';
import { join } from 'path';
import { Readable } from 'stream';
import { describe, expect, it } from 'vitest';
import { calibrationMs, recordPerf, watchLongestBlock } from '../../../perf.fixtures';
import { readConfig } from '../../design-config';
import { sketchMergeAnswer } from '../../studio-api';
import { resolveProduct } from '../resolve-product';
import { originOf } from '../write-origin';
import { createSketch, decideSketch, markSketchReady, Sketch } from './sketch';

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
  const ready = markSketchReady({ checkout: target, sketch: created }) as Sketch;

  decideSketch({ sketch: ready, decision: { kind: 'pick', variant: 'b', ...originOf('spec') } });

  return target;
};

describe('mergeSketch perf', { timeout: 60_000 }, () => {
  it('keeps the server thread answering while a Studio merge runs: no stall over 3 calibration units', async () => {
    const target = readyPickedSketch();
    const unitBefore = calibrationMs();
    const stop = watchLongestBlock();

    const answer = await sketchMergeAnswer({
      target,
      url: new URL('http://localhost/?product=acme&sketch=elements/hero'),
      request: Object.assign(Readable.from([Buffer.from('{}')]), { method: 'POST' }) as unknown as IncomingMessage,
    });

    const { longestMs, gc } = stop();
    const unitMs = Math.max(unitBefore, calibrationMs());
    const boundMs = unitMs * 3;

    recordPerf('merge-stall', { longestMs, boundMs, unitMs, gc });

    expect(answer.status).toBe(200);
    expect(longestMs).toBeLessThan(boundMs);
  });
});
