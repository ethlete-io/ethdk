import { EventEmitter } from 'events';
import { cpSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { Worker } from 'worker_threads';
import { afterAll, describe, expect, it } from 'vitest';
import { readConfig } from '../../design-config';
import { ruleProblemsOf } from '../check-system';
import { resolveProduct } from '../resolve-product';
import { createSketch, Sketch } from './sketch';
import { createSketchChecker, openSketchListingAt, SketchCheckRequest, SketchCheckResponse } from './sketch-checker';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-sketch-checker-'));

  cpSync(join(__dirname, '..', '__fixtures__'), target, { recursive: true });

  return target;
};

describe('createSketchChecker', () => {
  const check = createSketchChecker();

  afterAll(() => check.close());

  it('answers what the checks find on this thread, once for listings asked at once, and fails an unknown product', async () => {
    const target = acme();
    const product = resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });
    const sketch = createSketch({
      product,
      sketch: { layer: 'elements', name: 'hero' },
      variants: ['a', 'b'],
    }) as Sketch;

    writeFileSync(join(sketch.dir, 'b/elements/hero/hero.css'), '.acme-hero { color: #fff; }');

    const first = check({ target, product: 'acme' });
    const second = check({ target, product: 'acme' });

    expect(second).toBe(first);
    expect(await first).toEqual(openSketchListingAt({ target, product: 'acme' }));
    expect((await first).variants.map(({ variant, problems }) => [variant, problems.map(({ rule }) => rule)])).toEqual([
      ['a', []],
      ['b', ['HARD-CODED-COLOUR']],
    ]);
    await expect(check({ target, product: 'nope' })).rejects.toThrow(/nope/);
  }, 120_000);

  it('answers the rule problems of the files as they are when each check runs', async () => {
    const target = acme();
    const productOf = () =>
      resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });
    const hero = productOf().parts.find(({ name }) => name === 'hero');

    expect(await check.rules({ target, product: 'acme' })).toEqual(ruleProblemsOf(productOf()));

    writeFileSync(join(hero?.file ?? '', '..', 'hero.css'), '.acme-hero { color: #fff; }');

    const edited = await check.rules({ target, product: 'acme' });

    expect(edited).toEqual(ruleProblemsOf(productOf()));
    expect(edited.map(({ rule }) => rule)).toContain('HARD-CODED-COLOUR');
    await expect(check.rules({ target, product: 'nope' })).rejects.toThrow(/nope/);
  }, 120_000);
});

const fakeWorkers = () => {
  const started: {
    posted: SketchCheckRequest[];
    terminated: boolean;
    answer: (response: SketchCheckResponse) => void;
  }[] = [];
  const startWorker = () => {
    const events = new EventEmitter();
    const fake = {
      posted: [] as SketchCheckRequest[],
      terminated: false,
      answer: (response: SketchCheckResponse) => events.emit('message', response),
    };

    started.push(fake);

    return {
      postMessage: (request: SketchCheckRequest) => fake.posted.push(request),
      terminate: async () => {
        fake.terminated = true;

        return 1;
      },
      unref: () => undefined,
      on: (event: string, listener: (response: SketchCheckResponse) => void) => events.on(event, listener),
    } as unknown as Worker;
  };

  return { started, startWorker };
};

describe('createSketchChecker rules', () => {
  it('runs parallel rules of one product once, and ends the run when its last waiter aborts', async () => {
    const { started, startWorker } = fakeWorkers();
    const check = createSketchChecker({ startWorker });
    const [first, last] = [new AbortController(), new AbortController()];
    const asked = { target: '/checkout', product: 'acme' };
    const one = check.rules({ ...asked, signal: first.signal });
    const two = check.rules({ ...asked, signal: last.signal });

    expect(started.map(({ posted }) => posted.length)).toEqual([1]);

    first.abort();
    await expect(one).rejects.toThrow(/abort/i);
    expect(started[0]?.terminated).toBe(false);

    last.abort();
    await expect(two).rejects.toThrow(/abort/i);
    expect(started[0]?.terminated).toBe(true);

    const three = check.rules(asked);

    expect(started.map(({ posted }) => posted.length)).toEqual([1, 1]);
    started[1]?.answer({ id: started[1].posted[0]?.id ?? -1, result: [] });
    expect(await three).toEqual([]);
    await check.close();
  });

  it('drops a queued run whose last waiter aborts before the worker takes it', async () => {
    const { started, startWorker } = fakeWorkers();
    const check = createSketchChecker({ startWorker });
    const queued = new AbortController();
    const running = check.rules({ target: '/checkout', product: 'acme' });
    const dropped = check.rules({ target: '/checkout', product: 'other', signal: queued.signal });

    queued.abort();
    await expect(dropped).rejects.toThrow(/abort/i);
    started[0]?.answer({ id: started[0].posted[0]?.id ?? -1, result: [] });
    expect(await running).toEqual([]);
    expect(started.flatMap(({ posted }) => posted.map(({ product }) => product))).toEqual(['acme']);
    expect(started[0]?.terminated).toBe(false);
    await check.close();
  });
});
