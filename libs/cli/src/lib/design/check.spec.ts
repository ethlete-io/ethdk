import { existsSync, mkdtempSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkDesign } from './check';
import { statusPath, writeStatus } from './status';

const close = vi.fn(async () => undefined);
const goto = vi.fn(async (): Promise<void> => undefined);
const evaluate = vi.fn(async (): Promise<unknown> => null);
const launch = vi.fn(async () => ({ close, newPage: async () => ({ on: () => undefined, goto, evaluate }) }));
const browser = { chromium: { launch } as { launch: typeof launch } | null };
const server = { problem: null as string | null };

vi.mock('./browser', () => ({ chromiumOf: async () => browser.chromium }));
vi.mock('./stamp', () => ({
  buildStampOf: () => ({ version: '1', build: 'a' }),
  serverProblemOf: async () => server.problem,
}));

const checkout = () => mkdtempSync(join(tmpdir(), 'cli-design-check-'));

const statusOf = (target: string) => {
  const path = statusPath({ checkout: target, slug: 'app/one' });

  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as { state: string; message?: string }) : null;
};

const check = (target: string) => checkDesign({ target, argv: ['--call', 'app/one'], invocation: 'et design' });

describe('checkDesign', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    browser.chromium = { launch };
    server.problem = null;
    goto.mockImplementation(async () => undefined);
  });

  it('closes the browser and keeps the status when the page stops answering', async () => {
    const target = checkout();
    writeStatus({ checkout: target, slug: 'app/one', state: 'ready' });
    goto.mockImplementation(async () => {
      throw new Error('net::ERR_CONNECTION_REFUSED');
    });

    expect(await check(target)).toBe(1);
    expect(close).toHaveBeenCalledOnce();
    expect(statusOf(target)?.state).toBe('ready');
  });

  it('marks the call failed when the call itself is wrong', async () => {
    const target = checkout();

    expect(await check(target)).toBe(1);
    expect(statusOf(target)).toMatchObject({ state: 'failed', message: expect.stringContaining('NO CALL "app/one"') });
  });

  it('leaves the status alone when no browser resolves, and names playwright-core', async () => {
    const target = checkout();
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    browser.chromium = null;

    expect(await check(target)).toBe(1);
    expect(statusOf(target)).toBeNull();
    expect(errors).toHaveBeenCalledWith(expect.stringContaining('playwright-core install chromium'));
  });

  it('leaves the status alone when the server is unreachable or stale, without opening a browser', async () => {
    const target = checkout();
    writeStatus({ checkout: target, slug: 'app/one', state: 'drawing' });
    server.problem = 'STALE SERVER - restart it.';

    expect(await check(target)).toBe(1);
    expect(launch).not.toHaveBeenCalled();
    expect(statusOf(target)?.state).toBe('drawing');
  });
});
