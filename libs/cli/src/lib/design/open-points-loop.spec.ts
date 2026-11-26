import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { IncomingMessage } from 'http';
import { tmpdir } from 'os';
import { join } from 'path';
import { Readable } from 'stream';
import { setTimeout } from 'timers/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR } from './design-config';
import { openPointsAnswer } from './system/open-points.fixtures';

const BLOCK_MS = 1000;

vi.mock('./system/read-open-points', async (importOriginal) => {
  const original = await importOriginal<typeof import('./system/read-open-points')>();

  return {
    ...original,
    readOpenPoints: (...args: Parameters<typeof original.readOpenPoints>) => {
      const until = Date.now() + BLOCK_MS;

      while (Date.now() < until);

      return original.readOpenPoints(...args);
    },
  };
});

const targets: string[] = [];

const checkout = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-open-points-loop-'));
  const design = join(target, DESIGN_DIR);

  mkdirSync(join(design, 'app-a', 'pages/home'), { recursive: true });
  writeFileSync(
    join(design, 'app-a', 'pages/home/home.ts'),
    "export default definePart({ implements: { route: '/' }, states: { default: {} } });\n",
  );
  writeFileSync(join(design, 'config.json'), JSON.stringify({ products: { 'app-a': {} } }));
  targets.push(target);

  return target;
};

const ask = (target: string, path: string) => ({
  target,
  url: new URL(`http://localhost${path}`),
  request: Object.assign(Readable.from([]), { method: 'GET' }) as unknown as IncomingMessage,
});

const longestLoopGapWhile = async (run: () => Promise<unknown>) => {
  let last = performance.now();
  let longest = 0;
  const ticker = setInterval(() => {
    const now = performance.now();

    longest = Math.max(longest, now - last);
    last = now;
  }, 5);

  try {
    await setTimeout(20);
    await run();
    await setTimeout(20);
  } finally {
    clearInterval(ticker);
  }

  return longest;
};

describe('openPointsAnswer', () => {
  afterEach(() => {
    for (const target of targets.splice(0)) rmSync(target, { recursive: true, force: true });
  });

  it('keeps the server loop free while the open points compute', async () => {
    const target = checkout();
    let body: unknown;
    const gap = await longestLoopGapWhile(async () => {
      body = (await openPointsAnswer(ask(target, '/?product=app-a&part=pages/home'))).body;
    });

    expect(body).toEqual(expect.objectContaining({ part: 'pages/home', points: [] }));
    expect(gap).toBeLessThan(BLOCK_MS / 2);
  }, 60_000);
});
