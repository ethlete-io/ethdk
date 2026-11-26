import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import {
  LEGACY_LOCAL_CONFIG_FILE_NAME,
  LOCAL_CONFIG_FILE_NAME,
  configuredApiRepoBranch,
  configuredApiRepoPath,
  readLocalConfig,
  resolveConfiguredPath,
} from './local-config';

const rootWith = (files: Record<string, unknown>) => {
  const root = mkdtempSync(join(tmpdir(), 'cli-local-config-'));

  for (const [fileName, contents] of Object.entries(files)) {
    writeFileSync(join(root, fileName), typeof contents === 'string' ? contents : JSON.stringify(contents), 'utf8');
  }

  return root;
};

describe('readLocalConfig', () => {
  it('returns an empty config when neither file exists', () => {
    expect(readLocalConfig(rootWith({}))).toEqual({ config: {}, isLegacy: false });
  });

  it('reads the cli config file', () => {
    const root = rootWith({ [LOCAL_CONFIG_FILE_NAME]: { sdkSourcePath: '/sdk' } });

    expect(readLocalConfig(root)).toEqual({
      config: { sdkSourcePath: '/sdk' },
      fileName: LOCAL_CONFIG_FILE_NAME,
      isLegacy: false,
    });
  });

  it('falls back to the file the keys used to live in', () => {
    const root = rootWith({ [LEGACY_LOCAL_CONFIG_FILE_NAME]: { sdkSourcePath: '/old' } });

    expect(readLocalConfig(root)).toEqual({
      config: { sdkSourcePath: '/old' },
      fileName: LEGACY_LOCAL_CONFIG_FILE_NAME,
      isLegacy: true,
    });
  });

  it('prefers the cli config file over the legacy one', () => {
    const root = rootWith({
      [LOCAL_CONFIG_FILE_NAME]: { sdkSourcePath: '/new' },
      [LEGACY_LOCAL_CONFIG_FILE_NAME]: { sdkSourcePath: '/old' },
    });

    expect(readLocalConfig(root).config.sdkSourcePath).toBe('/new');
  });

  it('treats invalid json as absent', () => {
    expect(readLocalConfig(rootWith({ [LOCAL_CONFIG_FILE_NAME]: '{ not json' })).config).toEqual({});
  });

  it('treats a non-object as absent', () => {
    expect(readLocalConfig(rootWith({ [LOCAL_CONFIG_FILE_NAME]: [1, 2] })).config).toEqual({});
  });
});

describe('configuredApiRepoPath', () => {
  it('reads an exact key', () => {
    expect(configuredApiRepoPath({ apiRepoPaths: { hub: '../hub' } }, 'hub')).toBe('../hub');
  });

  it('falls back to the wildcard key', () => {
    expect(configuredApiRepoPath({ apiRepoPaths: { '*': '../any' } }, 'hub')).toBe('../any');
  });

  it('prefers the exact key over the wildcard', () => {
    expect(configuredApiRepoPath({ apiRepoPaths: { hub: '../hub', '*': '../any' } }, 'hub')).toBe('../hub');
  });

  it('returns undefined when nothing matches', () => {
    expect(configuredApiRepoPath({}, 'hub')).toBeUndefined();
  });
});

describe('configuredApiRepoBranch', () => {
  it('reads an exact key before the wildcard', () => {
    expect(configuredApiRepoBranch({ apiRepoBranches: { hub: 'develop', '*': 'main' } }, 'hub')).toBe('develop');
  });
});

describe('resolveConfiguredPath', () => {
  it('keeps an absolute path', () => {
    expect(resolveConfiguredPath('/repo', '/elsewhere/api')).toBe('/elsewhere/api');
  });

  it('resolves a relative path against the repo root', () => {
    expect(resolveConfiguredPath('/repo/app', '../api')).toBe('/repo/api');
  });
});
