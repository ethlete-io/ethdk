import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startMissingDistServer } from './render-missing-dist.fixtures';

let server: Awaited<ReturnType<typeof startMissingDistServer>> | null = null;

beforeAll(async () => {
  server = await startMissingDistServer();
}, 120_000);

afterAll(async () => {
  await server?.stop();
});

describe('a render.packages fixture on a missing dist, through the real render path', () => {
  it('answers the first call listing with an error', async () => {
    const response = await fetch(`${server?.base}/__design/calls`);
    const listed = (await response.json()) as { slug: string; error?: string }[];

    expect(listed).toHaveLength(1);
    expect(listed[0]?.error).toBeTruthy();
  });

  it('answers a render in the worker with the build command', async () => {
    const response = await fetch(`${server?.base}/__design/render`, {
      method: 'POST',
      body: JSON.stringify({ call: 'app/one', template: '<p></p>', imports: [], fields: null }),
    });
    const body = await response.text();

    expect(response.status).toBe(500);
    expect(body).toContain('missing, run `nx build components`');
  });
});
