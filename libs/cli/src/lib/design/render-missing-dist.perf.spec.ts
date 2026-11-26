import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { recordPerf } from '../perf.fixtures';
import { startMissingDistServer } from './render-missing-dist.fixtures';

const BUDGET_MS = 5000;

let server: Awaited<ReturnType<typeof startMissingDistServer>> | null = null;

beforeAll(async () => {
  server = await startMissingDistServer();
}, 120_000);

afterAll(async () => {
  await server?.stop();
});

describe('a render.packages fixture on a missing dist, through the real render path, perf', () => {
  it('answers the first call listing within the budget', async () => {
    const started = performance.now();
    const response = await fetch(`${server?.base}/__design/calls`);

    await response.json();

    const elapsedMs = performance.now() - started;

    recordPerf('render-missing-dist-calls', { elapsedMs, budgetMs: BUDGET_MS });

    expect(elapsedMs).toBeLessThan(BUDGET_MS);
  });

  it('answers a render in the worker within the budget', async () => {
    const started = performance.now();
    const response = await fetch(`${server?.base}/__design/render`, {
      method: 'POST',
      body: JSON.stringify({ call: 'app/one', template: '<p></p>', imports: [], fields: null }),
    });

    await response.text();

    const elapsedMs = performance.now() - started;

    recordPerf('render-missing-dist-render', { elapsedMs, budgetMs: BUDGET_MS, status: response.status });

    expect(elapsedMs).toBeLessThan(BUDGET_MS);
  });
});
