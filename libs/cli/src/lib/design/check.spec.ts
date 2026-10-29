import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkDesign } from './check';
import { readConfig } from './paths';
import { statusPath, writeStatus } from './status';
import { resolveProduct } from './system/resolve-product';
import { createSketch, Sketch } from './system/sketch/sketch';

const close = vi.fn(async () => undefined);
const goto = vi.fn(async (): Promise<void> => undefined);
const evaluate = vi.fn(async (): Promise<unknown> => null);
const launch = vi.fn(async () => ({ close, newPage: async () => ({ on: () => undefined, goto, evaluate }) }));
const browser = { chromium: { launch } as { launch: typeof launch } | null };
const server = { problem: null as string | null };

vi.mock('./browser', () => ({
  chromiumOf: async () =>
    browser.chromium ? { chromium: browser.chromium, from: '/co/node_modules/playwright/index.js' } : null,
}));
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

  it('names the resolved package, not a missing one, when its Chromium does not start', async () => {
    const target = checkout();
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    launch.mockRejectedValueOnce(new Error("Executable doesn't exist at /cache/chromium_headless_shell-1"));

    expect(await check(target)).toBe(1);

    const message = String(errors.mock.calls[errors.mock.calls.length - 1]?.[0]);

    expect(message).toContain('/co/node_modules/playwright/index.js resolved');
    expect(message).toContain("Executable doesn't exist");
    expect(message).not.toContain('neither the checkout');
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

describe('checkDesign --tsconfig', () => {
  it('types each variant of an open sketch and prints the tsc output of the one that fails', async () => {
    const target = mkdtempSync(join(tmpdir(), 'cli-design-check-sketch-'));

    cpSync(join(__dirname, 'system/__fixtures__'), target, { recursive: true });

    const product = resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });
    const sketch = createSketch({
      product,
      sketch: { layer: 'elements', name: 'hero' },
      variants: ['a', 'b'],
    }) as Sketch;

    writeFileSync(
      join(sketch.dir, 'b/elements/hero/hero.ts'),
      "import { definePart } from '@design-system';\nexport default definePart<{ a: string }>({ note: '', states: { default: { a: 1 } }, render: () => ({ body: '', styles: '' }) });\n",
    );

    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(checkDesign({ target, argv: ['--tsconfig'], invocation: 'et design' })).resolves.toBe(1);

    const text = errors.mock.calls.flat().join('\n');
    expect(text).toContain('TYPE ERROR in acme sketch elements/hero variant b');
    expect(text).toContain('hero.ts');
    expect(text).not.toContain('variant a');
    errors.mockRestore();
  }, 120_000);

  it('types an @assets/ URL import and an ?raw import as strings', async () => {
    const target = mkdtempSync(join(tmpdir(), 'cli-design-check-assets-'));

    cpSync(join(__dirname, 'system/__fixtures__'), target, { recursive: true });

    const product = resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });
    const sketch = createSketch({ product, sketch: { layer: 'elements', name: 'hero' }, variants: ['a'] }) as Sketch;

    mkdirSync(join(sketch.dir, 'a/assets/icons'), { recursive: true });
    writeFileSync(join(sketch.dir, 'a/assets/mark.png'), 'png');
    writeFileSync(join(sketch.dir, 'a/assets/icons/dot.svg'), '<svg/>');
    writeFileSync(
      join(sketch.dir, 'a/elements/hero/hero.ts'),
      "import { definePart } from '@design-system';\nimport mark from '@assets/mark.png';\nimport dot from '@assets/icons/dot.svg?raw';\nconst body: string = `<img src=\"${mark}\">${dot.trim()}`;\nexport default definePart({ note: '', states: { default: {} }, render: () => ({ body, styles: '' }) });\n",
    );

    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(checkDesign({ target, argv: ['--tsconfig'], invocation: 'et design' })).resolves.toBe(0);
    errors.mockRestore();
  }, 120_000);
});
