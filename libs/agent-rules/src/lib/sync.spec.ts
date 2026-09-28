import {
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  statSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONFIG_FILE_NAME, resolveRepoRoot } from './config';
import { check, sync } from './sync';

const consumerRepo = (config: unknown) => {
  const root = mkdtempSync(join(tmpdir(), 'agent-rules-sync-'));

  writeFileSync(join(root, CONFIG_FILE_NAME), JSON.stringify(config), 'utf8');
  writeFileSync(join(root, 'package.json'), JSON.stringify({ dependencies: {} }), 'utf8');

  return root;
};

const captureOutput = () => {
  const lines: string[] = [];
  const record = (...args: unknown[]) => lines.push(args.join(' '));

  vi.spyOn(console, 'log').mockImplementation(record);
  vi.spyOn(console, 'warn').mockImplementation(record);
  vi.spyOn(console, 'error').mockImplementation(record);

  return lines;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('sync and check report', () => {
  it('names content skipped for an unmet requires', () => {
    const root = consumerRepo({ targets: ['codex'] });

    for (const run of [() => sync({ root, dryRun: true }), () => check({ root })]) {
      const output = captureOutput();

      run();

      expect(output).toContain('  skip   theming — requires @ethlete/core, which is not installed');
      vi.restoreAllMocks();
    }
  });

  it('summarises out-of-profile content instead of listing it', () => {
    const root = consumerRepo({ targets: ['codex'] });
    const output = captureOutput();

    sync({ root, dryRun: true });

    expect(output.filter((line) => line.includes('scope "'))).toEqual([]);
    expect(output).toContainEqual(expect.stringMatching(/^ {2}skip {3}\d+ item\(s\) not meant for this profile$/));
  });

  it('warns when a path var does not resolve to a file', () => {
    const root = consumerRepo({ targets: ['codex'], vars: { themeStylesheet: 'src/styles/themes.css' } });
    const output = captureOutput();

    sync({ root, dryRun: true });

    expect(output).toContainEqual(expect.stringContaining('vars.themeStylesheet points at src/styles/themes.css'));
  });

  it('accepts a path var that resolves', () => {
    const root = consumerRepo({ targets: ['codex'], vars: { themeStylesheet: 'src/styles/themes.css' } });

    mkdirSync(join(root, 'src', 'styles'), { recursive: true });
    writeFileSync(join(root, 'src', 'styles', 'themes.css'), '', 'utf8');

    const output = captureOutput();

    sync({ root, dryRun: true });

    expect(output.filter((line) => line.includes('themeStylesheet'))).toEqual([]);
  });
});

describe('resolveRepoRoot', () => {
  it('walks up from a subdirectory to the directory holding the config', () => {
    const root = consumerRepo({ targets: ['codex'] });
    const nested = join(root, 'apps', 'api', 'src');

    mkdirSync(nested, { recursive: true });

    expect(resolveRepoRoot(nested)).toBe(root);
  });

  it('falls back to the start directory when no config exists above it', () => {
    const start = mkdtempSync(join(tmpdir(), 'agent-rules-no-config-'));

    expect(resolveRepoRoot(start)).toBe(start);
  });

  it('lets check run from a subdirectory report no drift after a sync', () => {
    const root = consumerRepo({ targets: ['codex'] });
    const nested = join(root, 'libs', 'shared');

    mkdirSync(nested, { recursive: true });
    captureOutput();
    sync({ root });

    expect(check({ root: resolveRepoRoot(nested) })).toBe(0);
  });
});

describe('sync writes', () => {
  it('rewrites only the files that changed', () => {
    const root = consumerRepo({ targets: ['claude'] });

    captureOutput();
    sync({ root });

    const [first, second] = readdirSync(join(root, '.claude', 'skills')).map((entry) =>
      join(root, '.claude', 'skills', entry, 'SKILL.md'),
    );

    if (!first || !second) throw new Error('expected at least two generated skills');

    utimesSync(first, new Date(0), new Date(0));
    appendFileSync(second, 'drift', 'utf8');
    sync({ root });

    expect(statSync(first).mtimeMs).toBe(0);
    expect(check({ root })).toBe(0);
  });

  it('survives a dangling symlink among the generated skills', () => {
    const root = consumerRepo({ targets: ['claude'] });

    mkdirSync(join(root, '.claude', 'skills'), { recursive: true });
    symlinkSync('missing-target', join(root, '.claude', 'skills', 'ethlete-broken'));
    captureOutput();

    expect(() => sync({ root })).not.toThrow();
    expect(() => check({ root })).not.toThrow();
  });
});
