import { cpSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { designSystem } from './system-command';

const cwd = process.cwd();

afterEach(() => {
  process.chdir(cwd);
  vi.restoreAllMocks();
});

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-system-command-'));

  cpSync(join(__dirname, '__fixtures__'), target, { recursive: true });

  return target;
};

const run = (target: string, argv: string[]) => designSystem({ target, argv, invocation: 'et design' });

describe('designSystem', () => {
  it('prints the parts list of one product as JSON', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    expect(await run(acme(), ['--json', '--product', 'acme'])).toBe(0);

    const products = JSON.parse(String(log.mock.calls[0]?.[0])) as { name: string; parts: { name: string }[] }[];

    expect(products.map((product) => product.name)).toEqual(['acme']);
    expect(products[0]?.parts.map((part) => part.name)).toEqual([
      'palette',
      'tokens',
      'button',
      'card',
      'hero',
      'home',
    ]);
  });

  it('refuses a run without --json, and a product config.json does not declare', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(await run(acme(), [])).toBe(2);
    expect(await run(acme(), ['--json', '--product'])).toBe(2);
    expect(await run(acme(), ['--json', '--product', 'nope'])).toBe(1);
    expect(error).toHaveBeenLastCalledWith('NO PRODUCT "nope" - config.json declares acme-base, acme.');
  });
});
