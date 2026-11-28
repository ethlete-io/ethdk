import { describe, expect, it } from 'vitest';
import { isBuildRunning, RunningProcess } from './build-running';

const nx = (name: string, cwd: string | null): RunningProcess => ({
  args: ['node', '/repo/node_modules/.bin/nx', 'build', name, '--skip-nx-cache'],
  cwd,
});

describe('isBuildRunning', () => {
  const dir = '/repo/dist/libs/core';

  it('is true while an nx build of the lib runs in the checkout', () => {
    expect(isBuildRunning({ dir, name: 'core', processes: () => [nx('core', '/repo')] })).toBe(true);
  });

  it('is true while the stale-build rebuild of the lib runs through nx run-many', () => {
    const rebuild: RunningProcess = {
      args: ['node', '/repo/node_modules/.bin/nx', 'run-many', '-t', 'build', '-p', 'core', '--skip-nx-cache'],
      cwd: '/repo',
    };

    expect(isBuildRunning({ dir, name: 'core', processes: () => [rebuild] })).toBe(true);
    expect(isBuildRunning({ dir, name: 'query', processes: () => [rebuild] })).toBe(false);
  });

  it('is true for every lib a captured nx run-many -p components,core builds', () => {
    const runMany: RunningProcess = {
      args: [
        'node',
        '/repo/node_modules/.bin/nx',
        'run-many',
        '-t',
        'build',
        '-p',
        'components,core',
        '--skip-nx-cache',
      ],
      cwd: '/repo',
    };

    expect(isBuildRunning({ dir: '/repo/dist/libs/components', name: 'components', processes: () => [runMany] })).toBe(
      true,
    );
    expect(isBuildRunning({ dir, name: 'core', processes: () => [runMany] })).toBe(true);
    expect(isBuildRunning({ dir, name: 'query', processes: () => [runMany] })).toBe(false);
  });

  it('is true while the captured nx task process builds the lib as a dependency of another build', () => {
    const task: RunningProcess = {
      args: ['/usr/bin/node', '/repo/node_modules/nx/dist/bin/run-executor.js'],
      cwd: '/repo',
      task: { project: 'core', target: 'build' },
    };
    const otherTarget: RunningProcess = { ...task, task: { project: 'core', target: 'build-generators' } };

    expect(isBuildRunning({ dir, name: 'core', processes: () => [task] })).toBe(true);
    expect(isBuildRunning({ dir, name: 'core', processes: () => [otherTarget] })).toBe(false);
    expect(isBuildRunning({ dir, name: 'core', processes: () => [{ ...task, cwd: '/repo-desk' }] })).toBe(false);
  });

  it('is true for nx build with several libs and nx run <lib>:build', () => {
    const command = (...args: string[]): RunningProcess => ({
      args: ['node', '/repo/node_modules/.bin/nx', ...args],
      cwd: '/repo',
    });

    expect(isBuildRunning({ dir, name: 'core', processes: () => [command('build', 'types', 'core')] })).toBe(true);
    expect(isBuildRunning({ dir, name: 'core', processes: () => [command('run', 'core:build')] })).toBe(true);
    expect(
      isBuildRunning({
        dir,
        name: 'core',
        processes: () => [command('run-many', '-t', 'build', '--projects=query,core')],
      }),
    ).toBe(true);
    expect(isBuildRunning({ dir, name: 'core', processes: () => [command('run', 'core:lint')] })).toBe(false);
  });

  it('is true when the working folder of the process is unknown', () => {
    expect(isBuildRunning({ dir, name: 'core', processes: () => [nx('core', null)] })).toBe(true);
  });

  it('is false for no build, another lib, or another checkout', () => {
    expect(isBuildRunning({ dir, name: 'core', processes: () => [] })).toBe(false);
    expect(isBuildRunning({ dir, name: 'core', processes: () => [nx('query', '/repo')] })).toBe(false);
    expect(isBuildRunning({ dir, name: 'core', processes: () => [nx('core', '/repo-desk')] })).toBe(false);
  });
});
