import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LOCAL_CONFIG_FILE_NAME } from '../config/local-config';
import * as utils from '../utils';
import { clearApiCheckouts, planApiClear } from './clear';
import { ApiDefinition } from './definition';

const HUB: ApiDefinition = { composeDir: 'development', services: ['app'], execService: 'app', port: 8040 };

// The confirm prompt reads stdin, which never answers here and would hang the run.
process.stdin.isTTY = false;

const errors: string[] = [];
const logs: string[] = [];

vi.spyOn(console, 'error').mockImplementation((message: unknown) => void errors.push(String(message)));
vi.spyOn(console, 'log').mockImplementation((message: unknown) => void logs.push(String(message)));

afterEach(() => {
  errors.length = 0;
  logs.length = 0;
});

const git = (cwd: string, args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' });

/** A managed checkout that looks like a clone: one commit, and a remote that holds it. */
const makeManagedCheckout = (options: { push?: boolean } = {}) => {
  const { push = true } = options;
  const root = mkdtempSync(join(tmpdir(), 'cli-api-clear-'));
  const repoPath = join(root, '.ethlete/hub');
  const remotePath = join(root, 'origin.git');

  mkdirSync(join(repoPath, 'development'), { recursive: true });
  execFileSync('git', ['init', '--bare', remotePath], { stdio: 'pipe' });
  git(repoPath, ['init', '--initial-branch', 'main']);
  git(repoPath, ['config', 'user.email', 'test@example.com']);
  git(repoPath, ['config', 'user.name', 'Test']);
  git(repoPath, ['remote', 'add', 'origin', remotePath]);

  writeFileSync(join(repoPath, 'README.md'), 'hub', 'utf8');
  git(repoPath, ['add', '.']);
  git(repoPath, ['commit', '-m', 'init']);

  if (push) git(repoPath, ['push', '-u', 'origin', 'main']);

  return { root, repoPath };
};

const plan = (root: string, overrides: Partial<Parameters<typeof planApiClear>[0]> = {}) =>
  planApiClear({
    apis: { hub: HUB },
    names: ['hub'],
    root,
    invocation: 'et api',
    force: false,
    hasContainers: () => false,
    ...overrides,
  });

describe('planApiClear', () => {
  it('plans the removal of a clean managed checkout', () => {
    const { root, repoPath } = makeManagedCheckout();

    expect(plan(root)).toEqual([
      { name: 'hub', repoPath, composePath: join(repoPath, 'development'), hasContainers: false, blockers: [] },
    ]);
  });

  it('leaves out an API with no checkout', () => {
    expect(plan(mkdtempSync(join(tmpdir(), 'cli-api-clear-')))).toEqual([]);
  });

  it('refuses a checkout the developer configured themselves', () => {
    const root = mkdtempSync(join(tmpdir(), 'cli-api-clear-'));

    mkdirSync(join(root, 'own/development'), { recursive: true });
    writeFileSync(join(root, LOCAL_CONFIG_FILE_NAME), JSON.stringify({ apiRepoPaths: { hub: './own' } }), 'utf8');

    expect(plan(root)[0]?.blockers[0]).toContain('is your own checkout');
    expect(plan(root)[0]?.blockers[0]).toContain('apiRepoPaths.hub');
  });

  it('marks the containers instead of refusing the removal', () => {
    const { root } = makeManagedCheckout();

    expect(plan(root, { hasContainers: () => true })[0]).toMatchObject({ hasContainers: true, blockers: [] });
  });

  it('refuses a checkout with uncommitted changes', () => {
    const { root, repoPath } = makeManagedCheckout();

    writeFileSync(join(repoPath, 'README.md'), 'changed', 'utf8');

    const [blocker] = plan(root)[0]?.blockers ?? [];

    expect(blocker).toContain('has uncommitted changes:');
    expect(blocker).toContain(' M README.md');
  });

  it('refuses a checkout with commits no remote holds', () => {
    const { root } = makeManagedCheckout({ push: false });

    const [blocker] = plan(root)[0]?.blockers ?? [];

    expect(blocker).toContain('has commits no remote holds:');
    expect(blocker).toContain('init');
  });

  it('keeps the containers marked under --force', () => {
    const { root } = makeManagedCheckout();
    const [target] = plan(root, { force: true, hasContainers: () => true });

    expect(target).toMatchObject({ hasContainers: true, blockers: [] });
  });

  it('plans every named API at once', () => {
    const { root } = makeManagedCheckout();

    expect(plan(root, { apis: { hub: HUB, other: HUB }, names: ['hub', 'other'] })).toHaveLength(1);
  });
});

describe('clearApiCheckouts', () => {
  const clear = (root: string, overrides: Partial<Parameters<typeof clearApiCheckouts>[0]> = {}) =>
    clearApiCheckouts({
      apis: { hub: HUB },
      names: ['hub'],
      root,
      invocation: 'et api',
      force: false,
      hasContainers: () => false,
      takeDown: () => true,
      ...overrides,
    });

  it('says there is nothing to remove', async () => {
    expect(await clear(mkdtempSync(join(tmpdir(), 'cli-api-clear-')))).toBe(0);
    expect(logs[0]).toContain('Nothing to remove.');
  });

  it('reports every blocker and fails', async () => {
    const { root, repoPath } = makeManagedCheckout();

    writeFileSync(join(repoPath, 'README.md'), 'changed', 'utf8');

    expect(await clear(root)).toBe(1);
    expect(errors[0]).toContain('has uncommitted changes');
  });

  it('keeps the checkout when the question cannot be answered', async () => {
    const { root, repoPath } = makeManagedCheckout();

    expect(await clear(root, { force: true })).toBe(1);
    expect(existsSync(repoPath)).toBe(true);
    expect(errors.join('\n')).toContain('This removes:');
  });

  it('offers to take the containers down instead of refusing', async () => {
    const { root } = makeManagedCheckout();

    expect(await clear(root, { hasContainers: () => true })).toBe(1);
    expect(errors.join('\n')).toContain('This takes hub down, then removes:');
    expect(errors.join('\n')).toContain('or run "et api down hub" and remove the directories yourself');
  });

  it('takes the containers down before it removes the checkout', async () => {
    const { root, repoPath } = makeManagedCheckout();
    const asked = vi.spyOn(utils, 'confirm').mockResolvedValue(true);
    const taken: string[] = [];

    const code = await clear(root, {
      hasContainers: () => true,
      takeDown: (composePath) => {
        taken.push(composePath);

        return true;
      },
    });

    expect(code).toBe(0);
    expect(taken).toEqual([join(repoPath, 'development')]);
    expect(existsSync(repoPath)).toBe(false);
    expect(asked.mock.calls[0]?.[0].question).toBe('Take hub down and remove the checkout?');

    asked.mockRestore();
  });

  it('keeps the checkout when the take-down fails', async () => {
    const { root, repoPath } = makeManagedCheckout();
    const asked = vi.spyOn(utils, 'confirm').mockResolvedValue(true);

    expect(await clear(root, { hasContainers: () => true, takeDown: () => false })).toBe(1);
    expect(existsSync(repoPath)).toBe(true);
    expect(errors.join('\n')).toContain('Could not take hub down');

    asked.mockRestore();
  });
});
