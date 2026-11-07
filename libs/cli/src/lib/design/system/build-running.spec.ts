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

  it('is true when the working folder of the process is unknown', () => {
    expect(isBuildRunning({ dir, name: 'core', processes: () => [nx('core', null)] })).toBe(true);
  });

  it('is false for no build, another lib, or another checkout', () => {
    expect(isBuildRunning({ dir, name: 'core', processes: () => [] })).toBe(false);
    expect(isBuildRunning({ dir, name: 'core', processes: () => [nx('query', '/repo')] })).toBe(false);
    expect(isBuildRunning({ dir, name: 'core', processes: () => [nx('core', '/repo-desk')] })).toBe(false);
  });
});
