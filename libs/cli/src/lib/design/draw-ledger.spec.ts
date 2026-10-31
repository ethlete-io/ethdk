import { IncomingMessage, ServerResponse } from 'http';
import { describe, expect, it, vi } from 'vitest';
import { createDrawLedger, KEPT_FAILURES } from './draw-ledger';
import { DRAWS_AT_ONCE, createDrawQueue, createThumbnailer } from './thumb';

const withBrowser = vi.fn(async () => ({
  chromium: { launch: async () => ({ close: async () => undefined }) } as never,
  from: '/co/node_modules/playwright/index.js',
}));

const ask = (middleware: (request: IncomingMessage, response: ServerResponse) => void, url: string) =>
  new Promise<number>((done) => {
    const response = { statusCode: 200, setHeader: () => undefined, end: () => done(response.statusCode) };

    middleware({ url } as IncomingMessage, response as unknown as ServerResponse);
  });

describe('createDrawLedger', () => {
  it('counts the queued and drawing jobs of a draw queue and the age of the oldest', async () => {
    let clock = 1000;
    const ledger = createDrawLedger(() => clock);
    const queue = createDrawQueue({ target: '/co', chromiumOf: withBrowser, ledger });
    const releases: (() => void)[] = [];
    const drawn = Array.from({ length: DRAWS_AT_ONCE + 2 }, () =>
      queue.run(() => new Promise<void>((done) => releases.push(done))),
    );

    expect(createDrawLedger().report()).toEqual({
      queued: 0,
      rendering: 0,
      oldestMs: null,
      failedTotal: 0,
      failed: [],
    });

    await vi.waitFor(() => expect(releases).toHaveLength(DRAWS_AT_ONCE));
    clock = 13000;
    expect(ledger.report()).toMatchObject({ queued: 2, rendering: DRAWS_AT_ONCE, oldestMs: 12000 });

    releases.splice(0).forEach((release) => release());
    await vi.waitFor(() => expect(releases).toHaveLength(2));
    releases.splice(0).forEach((release) => release());
    await Promise.all(drawn);

    expect(ledger.report()).toMatchObject({ queued: 0, rendering: 0, oldestMs: null });
  });

  it('lists the shots that failed, newest first, with their status', async () => {
    const ledger = createDrawLedger(() => Date.parse('2026-10-31T10:00:00Z'));
    const { middleware } = createThumbnailer({
      target: '/co',
      base: 'http://localhost:4999',
      chromiumOf: async () => null,
      ledger,
    });

    expect(await ask(middleware, '/?call=app%2Fone&variant=a')).toBe(503);
    expect(await ask(middleware, '/?call=app%2Fone')).toBe(400);

    expect(ledger.report()).toMatchObject({
      queued: 0,
      rendering: 0,
      failedTotal: 1,
      failed: [
        {
          part: 'app/one',
          state: 'a',
          status: 503,
          message: expect.stringContaining('playwright'),
          at: '2026-10-31T10:00:00.000Z',
        },
      ],
    });
  });

  it(`keeps the last ${KEPT_FAILURES} failures and counts them all`, () => {
    const ledger = createDrawLedger();

    for (let at = 0; at < KEPT_FAILURES + 5; at++) {
      ledger.fail({ part: 'p', state: String(at), status: 500, message: 'broke' });
    }

    const report = ledger.report();

    expect(report.failedTotal).toBe(KEPT_FAILURES + 5);
    expect(report.failed).toHaveLength(KEPT_FAILURES);
    expect(report.failed[0]?.state).toBe(String(KEPT_FAILURES + 4));
  });

  it('drops the failures of a sketch variant that is gone from the list and the count', () => {
    const gone = new Set<string>();
    const ledger = createDrawLedger(Date.now, (failure) => !failure.sketch || !gone.has(failure.sketch.target));
    const sketch = { product: 'sdk', target: 'components/tree', variant: 'a' };

    ledger.fail({ part: 'sdk/components/tree', state: 'expanded', status: 500, message: 'broke', sketch });
    ledger.fail({ part: 'sdk/components/tree', state: 'nope', status: 404, message: 'no state' });

    expect(ledger.report()).toMatchObject({ failedTotal: 2, failed: [{ state: 'nope' }, { state: 'expanded' }] });

    gone.add('components/tree');

    expect(ledger.report()).toMatchObject({ failedTotal: 1, failed: [{ state: 'nope' }] });
  });

  it('never counts a failure of a sketch variant that was already gone when it failed', () => {
    const ledger = createDrawLedger(Date.now, (failure) => !failure.sketch);

    ledger.fail({
      part: 'sdk/components/tree',
      state: 'expanded',
      status: 404,
      message: 'no part',
      sketch: { product: 'sdk', target: 'components/tree', variant: 'a' },
    });

    expect(ledger.report()).toMatchObject({ failedTotal: 0, failed: [] });
  });
});
