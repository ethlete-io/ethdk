import { readFileSync } from 'fs';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { git, gitEnv, tempGitRepo } from './git-test-env.fixtures';

const saved = { GIT_DIR: process.env['GIT_DIR'], GIT_INDEX_FILE: process.env['GIT_INDEX_FILE'] };

afterEach(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('git test helper', () => {
  it('leaves the repo a hook points at untouched', () => {
    const hookRepo = tempGitRepo('git-env-hook-');
    const configPath = join(hookRepo, '.git', 'config');
    const before = readFileSync(configPath);

    process.env['GIT_DIR'] = join(hookRepo, '.git');
    process.env['GIT_INDEX_FILE'] = join(hookRepo, '.git', 'index');

    const temp = tempGitRepo('git-env-temp-');
    git(temp, 'config', 'user.email', 'x@y');
    git(temp, 'config', 'user.name', 'x');
    git(temp, 'commit', '--allow-empty', '-qm', 'one');

    expect(git(temp, 'log', '--format=%s')).toBe('one');
    expect(readFileSync(configPath).equals(before)).toBe(true);
  });

  it('keeps GIT_* values set explicitly for the call', () => {
    expect(gitEnv({ GIT_AUTHOR_NAME: 'A' })['GIT_AUTHOR_NAME']).toBe('A');
  });
});
