import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { detectPackageManager, nxCommand } from './package-manager';

const makeRoot = () => mkdtempSync(join(tmpdir(), 'cli-manager-'));

const touch = (root: string, fileName: string) => writeFileSync(join(root, fileName), '', 'utf8');

describe('detectPackageManager', () => {
  it('follows the packageManager field', () => {
    const manager = detectPackageManager({ root: makeRoot(), manifest: { packageManager: 'yarn@4.17.1' }, env: {} });

    expect(manager.name).toBe('yarn');
    expect(manager.install).toEqual(['yarn', 'install']);
  });

  it('follows the lockfile when the field says nothing', () => {
    const root = makeRoot();

    touch(root, 'pnpm-lock.yaml');

    expect(detectPackageManager({ root, env: {} }).name).toBe('pnpm');
  });

  it('follows the user agent of the running install', () => {
    expect(
      detectPackageManager({ root: makeRoot(), env: { npm_config_user_agent: 'bun/1.1.0 npm/? node/v22' } }).name,
    ).toBe('bun');
  });

  it('falls back to npm', () => {
    expect(detectPackageManager({ root: makeRoot(), env: {} }).name).toBe('npm');
  });
});

describe('nxCommand', () => {
  it('runs nx through the package manager', () => {
    const manager = detectPackageManager({ root: makeRoot(), manifest: { packageManager: 'yarn@4.17.1' }, env: {} });

    expect(nxCommand({ manager, args: ['generate', '@ethlete/core:migrate-x'] })).toEqual([
      'yarn',
      'nx',
      'generate',
      '@ethlete/core:migrate-x',
    ]);
  });
});
