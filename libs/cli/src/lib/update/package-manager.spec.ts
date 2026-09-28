import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { spawnSync } from 'child_process';
import { describe, expect, it, vi } from 'vitest';
import { detectPackageManager, nxCommand, spawnPackageManager } from './package-manager';

vi.mock('child_process', async (importOriginal) => ({
  ...(await importOriginal<typeof import('child_process')>()),
  spawnSync: vi.fn(() => ({ status: 0 })),
}));

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

  it('follows the lockfile over the user agent of npx', () => {
    const root = makeRoot();

    touch(root, 'yarn.lock');

    expect(detectPackageManager({ root, env: { npm_config_user_agent: 'npm/10.8.2 node/v22 linux x64' } }).name).toBe(
      'yarn',
    );
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

describe('spawnPackageManager', () => {
  it('spawns the binary directly outside Windows', () => {
    spawnPackageManager({ binary: 'yarn', args: ['install'], spawn: { cwd: '/repo' }, platform: 'linux' });

    expect(vi.mocked(spawnSync)).toHaveBeenLastCalledWith('yarn', ['install'], { cwd: '/repo' });
  });

  it('runs the .cmd shim through a shell on Windows, with quoted arguments', () => {
    spawnPackageManager({
      binary: 'yarn',
      args: ['nx', 'generate', '@ethlete/core:migrate', 'a "b" c'],
      spawn: { cwd: 'C:\\repo' },
      platform: 'win32',
    });

    expect(vi.mocked(spawnSync)).toHaveBeenLastCalledWith('yarn nx generate @ethlete/core:migrate "a ""b"" c"', {
      cwd: 'C:\\repo',
      shell: true,
    });
  });
});
