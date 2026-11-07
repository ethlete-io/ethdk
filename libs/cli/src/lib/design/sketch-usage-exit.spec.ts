import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { designSketch } from './sketch-command';

const SUBCOMMANDS = [
  'new',
  'variant',
  'round',
  'note',
  'report',
  'ready',
  'hold',
  'release',
  'preview',
  'rebase',
  'merge',
  'discard',
  'target',
  'reject',
  'reopen',
  'withdraw',
];

const targets: string[] = [];

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-sketch-usage-'));

  targets.push(target);
  cpSync(join(__dirname, 'system/__fixtures__'), target, { recursive: true });
  writeFileSync(join(target, '.prettierignore'), '*\n');

  return target;
};

const silenced = () => {
  const lines: string[] = [];

  vi.spyOn(console, 'log').mockImplementation((line) => void lines.push(String(line)));
  vi.spyOn(console, 'error').mockImplementation((line) => void lines.push(String(line)));

  return lines;
};

afterEach(() => {
  vi.restoreAllMocks();
  targets.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

describe('sketch usage errors end with a non-zero exit', () => {
  it.each(SUBCOMMANDS)('%s without arguments says what is wrong and fails', async (command) => {
    const lines = silenced();

    expect(
      await designSketch({ target: acme(), argv: [command, '--product', 'acme'], invocation: 'et design' }),
    ).not.toBe(0);
    expect(lines.length).toBeGreaterThan(0);
  });

  it.each(SUBCOMMANDS)('%s with only --by fails', async (command) => {
    silenced();
    const argv = [command, '--by', 'claude-opus-5-5', '--product', 'acme'];

    expect(await designSketch({ target: acme(), argv, invocation: 'et design' })).not.toBe(0);
  });

  it('ready without --by fails', async () => {
    const lines = silenced();
    const argv = ['ready', 'components/button', '--product', 'acme'];

    expect(await designSketch({ target: acme(), argv, invocation: 'et design' })).not.toBe(0);
    expect(lines.join('\n')).toContain('--by');
  });
});
