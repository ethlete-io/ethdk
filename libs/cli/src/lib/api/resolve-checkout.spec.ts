import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { LOCAL_CONFIG_FILE_NAME } from '../config/local-config';
import { ApiDefinition } from './definition';
import { checkoutProblem, managedCheckoutPath, resolveApiCheckout } from './resolve-checkout';

const api: ApiDefinition = {
  composeDir: 'development',
  services: ['app'],
  execService: 'app',
  port: 8000,
  envFile: '.env',
  setupCommand: 'make setup',
  repoUrl: 'git@example.com:app/api.git',
};

const makeRoot = (config?: unknown) => {
  const root = mkdtempSync(join(tmpdir(), 'cli-checkout-'));

  if (config) writeFileSync(join(root, LOCAL_CONFIG_FILE_NAME), JSON.stringify(config), 'utf8');

  return root;
};

const makeCheckout = (options: { repoPath: string; env?: boolean }) => {
  mkdirSync(join(options.repoPath, 'development'), { recursive: true });

  if (options.env) writeFileSync(join(options.repoPath, 'development', '.env'), '', 'utf8');
};

describe('resolveApiCheckout', () => {
  it('offers to clone when the managed directory is empty and the API has a repoUrl', () => {
    const root = makeRoot();
    const result = resolveApiCheckout({ root, name: 'app', api });

    expect(result).toMatchObject({
      ok: false,
      clonable: { repoUrl: api.repoUrl, into: managedCheckoutPath(root, 'app') },
    });
  });

  it('explains how to configure a path when there is no repoUrl to clone from', () => {
    const result = resolveApiCheckout({ root: makeRoot(), name: 'app', api: { ...api, repoUrl: undefined } });

    expect(result).toMatchObject({ ok: false, problem: expect.stringContaining('apiRepoPaths') });
    expect(result).not.toHaveProperty('clonable');
  });

  it('fails a configured path that is not a directory', () => {
    const result = resolveApiCheckout({ root: makeRoot({ apiRepoPaths: { app: 'nowhere' } }), name: 'app', api });

    expect(result).toMatchObject({ ok: false, problem: expect.stringContaining('not a directory that exists') });
  });

  it('offers setup when the env file is missing and the API has a setupCommand', () => {
    const root = makeRoot();

    makeCheckout({ repoPath: managedCheckoutPath(root, 'app') });

    const result = resolveApiCheckout({ root, name: 'app', api });

    expect(result).toMatchObject({ ok: false, setupable: { setupCommand: 'make setup', envFile: '.env' } });
  });

  it('does not demand the env file for setup, and returns the compose path', () => {
    const root = makeRoot();
    const repoPath = managedCheckoutPath(root, 'app');

    makeCheckout({ repoPath });

    expect(resolveApiCheckout({ root, name: 'app', api, needs: 'compose' })).toMatchObject({
      ok: true,
      checkout: { repoPath, composePath: join(repoPath, 'development') },
    });
  });

  it('only needs the repo for the git commands', () => {
    const root = makeRoot();

    mkdirSync(managedCheckoutPath(root, 'app'), { recursive: true });

    expect(resolveApiCheckout({ root, name: 'app', api, needs: 'repo' })).toMatchObject({ ok: true });
  });

  it('fails a checkout without the compose directory', () => {
    const root = makeRoot();

    mkdirSync(managedCheckoutPath(root, 'app'), { recursive: true });

    expect(resolveApiCheckout({ root, name: 'app', api })).toMatchObject({
      ok: false,
      problem: expect.stringContaining('has no development directory'),
    });
  });

  it('resolves a complete checkout', () => {
    const root = makeRoot();

    makeCheckout({ repoPath: managedCheckoutPath(root, 'app'), env: true });

    expect(resolveApiCheckout({ root, name: 'app', api })).toMatchObject({ ok: true });
  });
});

describe('checkoutProblem', () => {
  it('names the command that fixes the problem', () => {
    const base = { ok: false as const, problem: 'Broken.' };

    expect(
      checkoutProblem({
        failure: { ...base, clonable: { repoUrl: 'u', into: 'i' } },
        name: 'app',
        invocation: 'et api',
      }),
    ).toBe('Broken. Run "et api clone app".');
    expect(checkoutProblem({ failure: base, name: 'app', invocation: 'et api' })).toBe('Broken.');
  });
});
