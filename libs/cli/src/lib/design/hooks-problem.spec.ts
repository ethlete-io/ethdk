import { spawnSync } from 'child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { hooksProblemOf } from './hooks-problem';

const dirs: string[] = [];

const repoOf = (options: { husky: boolean }) => {
  const repo = realpathSync(mkdtempSync(join(tmpdir(), 'hooks-problem-')));
  dirs.push(repo);
  spawnSync('git', ['init', '--quiet'], { cwd: repo });

  if (options.husky) {
    mkdirSync(join(repo, '.husky'), { recursive: true });
    writeFileSync(join(repo, '.husky', 'pre-commit'), '');
  }

  return repo;
};

afterEach(() => dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));

describe('hooksProblemOf', () => {
  it('names a husky checkout whose hooks are not installed', () => {
    expect(hooksProblemOf(repoOf({ husky: true }))).toContain('HOOKS NOT INSTALLED');
  });

  it('is silent once core.hooksPath is the relative .husky', () => {
    const repo = repoOf({ husky: true });
    spawnSync('git', ['config', 'core.hooksPath', '.husky'], { cwd: repo });

    expect(hooksProblemOf(repo)).toBeNull();
  });

  it('is silent for a repository without husky', () => {
    expect(hooksProblemOf(repoOf({ husky: false }))).toBeNull();
  });
});
