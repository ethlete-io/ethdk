import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { repoInvocation } from './invocation';

const makeRoot = (manifest?: unknown) => {
  const root = mkdtempSync(join(tmpdir(), 'cli-invocation-'));

  if (manifest !== undefined) {
    writeFileSync(join(root, 'package.json'), JSON.stringify(manifest), 'utf8');
  }

  return root;
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('repoInvocation', () => {
  it('names the script that wraps the command', () => {
    const root = makeRoot({ packageManager: 'yarn@4.18.0', scripts: { api: 'et api' } });

    expect(repoInvocation({ root, subcommand: 'api' })).toBe('yarn api');
  });

  it('names the binary the package manager way when no script wraps it', () => {
    const root = makeRoot({ packageManager: 'npm@10.9.0' });

    expect(repoInvocation({ root, subcommand: 'api' })).toBe('npx et api');
  });

  it('ignores a script that runs another command', () => {
    const root = makeRoot({ packageManager: 'pnpm@10.0.0', scripts: { api: 'et doctor' } });

    expect(repoInvocation({ root, subcommand: 'api' })).toBe('pnpm exec et api');
  });

  it('reads the package manager that is running when the manifest declares none', () => {
    vi.stubEnv('npm_config_user_agent', 'yarn/4.18.0 npm/? node/v24.17.0 linux x64');

    const root = makeRoot({ scripts: { api: 'et api' } });

    expect(repoInvocation({ root, subcommand: 'api' })).toBe('yarn api');
  });

  it('is the bare command outside any package manager', () => {
    vi.stubEnv('npm_config_user_agent', '');

    expect(repoInvocation({ root: makeRoot(), subcommand: 'api' })).toBe('et api');
  });
});
