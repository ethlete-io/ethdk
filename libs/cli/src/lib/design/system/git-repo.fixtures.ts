import { execFileSync, spawnSync } from 'child_process';
import { vi } from 'vitest';
import { HEAVY_DESIGN_SPEC_TIMEOUT_MS } from './check-system.fixtures';

vi.setConfig({ testTimeout: HEAVY_DESIGN_SPEC_TIMEOUT_MS });

const IDENTITY = ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false'];

export const git = (target: string, ...args: string[]) =>
  execFileSync('git', [...IDENTITY, ...args], { cwd: target, stdio: 'pipe' });

export const gitResult = (target: string, ...args: string[]) =>
  spawnSync('git', [...IDENTITY, ...args], { cwd: target, encoding: 'utf8' });

export const commitAll = (target: string, message: string) => {
  git(target, 'add', '.');
  git(target, 'commit', '-qm', message);
};

export const initGitRepo = (target: string, message: string) => {
  git(target, 'init', '-q');
  commitAll(target, message);
};
