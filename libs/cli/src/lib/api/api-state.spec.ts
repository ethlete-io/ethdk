import { mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'fs';
import { homedir, tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { apiStateDirectory, composeProjectName, markApiStateDirty, readApiState, writeApiState } from './api-state';

const composeDir = (name = 'development') => {
  const path = join(mkdtempSync(join(tmpdir(), 'cli-api-state-')), name);

  mkdirSync(path, { recursive: true });

  return path;
};

describe('composeProjectName', () => {
  it('falls back to the normalized directory name, like compose', () => {
    expect(composeProjectName({ composePath: composeDir('My.Api_dev-1'), env: {} })).toBe('myapi_dev-1');
  });

  it('reads the top-level name of the compose file', () => {
    const path = composeDir();

    writeFileSync(join(path, 'compose.yml'), 'name: "hub-api"\nservices:\n  app:\n    image: x\n', 'utf8');

    expect(composeProjectName({ composePath: path, env: {} })).toBe('hub-api');
  });

  it('prefers COMPOSE_PROJECT_NAME from the .env file over the compose file', () => {
    const path = composeDir();

    writeFileSync(join(path, 'docker-compose.yml'), 'name: hub-api\n', 'utf8');
    writeFileSync(join(path, '.env'), 'APP_ENV=dev\nCOMPOSE_PROJECT_NAME=hub\n', 'utf8');

    expect(composeProjectName({ composePath: path, env: {} })).toBe('hub');
  });

  it('prefers COMPOSE_PROJECT_NAME from the environment over everything else', () => {
    const path = composeDir();

    writeFileSync(join(path, '.env'), 'COMPOSE_PROJECT_NAME=hub\n', 'utf8');

    expect(composeProjectName({ composePath: path, env: { COMPOSE_PROJECT_NAME: 'Shared' } })).toBe('shared');
  });

  it('ignores an interpolated name it cannot resolve', () => {
    const path = composeDir('api');

    writeFileSync(join(path, 'compose.yaml'), 'name: ${PROJECT}\n', 'utf8');

    expect(composeProjectName({ composePath: path, env: {} })).toBe('api');
  });
});

describe('apiStateDirectory', () => {
  it('lives under XDG_STATE_HOME', () => {
    expect(apiStateDirectory({ project: 'hub', env: { XDG_STATE_HOME: '/state' } })).toBe('/state/ethlete/api/hub');
  });

  it('falls back to ~/.local/state', () => {
    expect(apiStateDirectory({ project: 'hub', env: {} })).toBe(join(homedir(), '.local/state/ethlete/api/hub'));
  });
});

describe('api state', () => {
  const directory = () => join(mkdtempSync(join(tmpdir(), 'cli-api-state-')), 'nested/hub');

  it('reads nothing before the first write', () => {
    expect(readApiState(directory())).toBeUndefined();
  });

  it('writes and reads the state, leaving no temporary file behind', () => {
    const path = directory();
    const now = new Date('2026-10-19T10:00:00.000Z');

    writeApiState({ directory: path, state: { profile: 'e2e', fingerprint: 'abc123def456', dirty: false }, now });

    expect(readApiState(path)).toEqual({
      profile: 'e2e',
      fingerprint: 'abc123def456',
      dirty: false,
      updatedAt: now.toISOString(),
    });
    expect(readdirSync(path)).toEqual(['state.json']);
  });

  it('marks the state dirty and keeps what it was', () => {
    const path = directory();

    writeApiState({ directory: path, state: { profile: 'e2e', fingerprint: 'abc123def456', dirty: false } });
    markApiStateDirty(path);

    expect(readApiState(path)).toMatchObject({ profile: 'e2e', fingerprint: 'abc123def456', dirty: true });
  });

  it('marks a missing state dirty', () => {
    const path = directory();

    markApiStateDirty(path);

    expect(readApiState(path)).toMatchObject({ profile: null, fingerprint: null, dirty: true });
  });

  it('reads a corrupt file as no state', () => {
    const path = directory();

    mkdirSync(path, { recursive: true });
    writeFileSync(join(path, 'state.json'), '{', 'utf8');

    expect(readApiState(path)).toBeUndefined();
  });
});
