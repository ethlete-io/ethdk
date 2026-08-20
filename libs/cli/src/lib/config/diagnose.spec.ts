import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { diagnoseLocalConfig } from './diagnose';
import { LEGACY_LOCAL_CONFIG_FILE_NAME, LOCAL_CONFIG_FILE_NAME } from './local-config';

const SDK_MARKERS = ['libs/components', 'libs/core', 'libs/agent-rules'];

const makeRoot = () => mkdtempSync(join(tmpdir(), 'cli-diagnose-'));

const write = (root: string, fileName: string, contents: unknown) =>
  writeFileSync(join(root, fileName), typeof contents === 'string' ? contents : JSON.stringify(contents), 'utf8');

const makeSdkCheckout = (root: string, name = 'sdk') => {
  for (const marker of SDK_MARKERS) mkdirSync(join(root, name, marker), { recursive: true });

  return `./${name}`;
};

describe('diagnoseLocalConfig', () => {
  it('reports nothing when neither file exists', () => {
    expect(diagnoseLocalConfig({ root: makeRoot() })).toEqual([]);
  });

  it('reports a file that is not valid json', () => {
    const root = makeRoot();

    write(root, LOCAL_CONFIG_FILE_NAME, '{ not json');

    expect(diagnoseLocalConfig({ root })).toEqual([`${LOCAL_CONFIG_FILE_NAME} is not valid JSON.`]);
  });

  it('reports a file that is not a json object', () => {
    const root = makeRoot();

    write(root, LOCAL_CONFIG_FILE_NAME, [1, 2]);

    expect(diagnoseLocalConfig({ root })).toEqual([`${LOCAL_CONFIG_FILE_NAME} is not a JSON object.`]);
  });

  it('reports a key nothing reads', () => {
    const root = makeRoot();

    write(root, LOCAL_CONFIG_FILE_NAME, { apiRepoPath: './api' });

    expect(diagnoseLocalConfig({ root })[0]).toContain('key(s) nothing reads: "apiRepoPath"');
  });

  describe('sdkSourcePath', () => {
    it('accepts a real sdk checkout', () => {
      const root = makeRoot();

      write(root, LOCAL_CONFIG_FILE_NAME, { sdkSourcePath: makeSdkCheckout(root) });

      expect(diagnoseLocalConfig({ root })).toEqual([]);
    });

    it('rejects a path that does not exist', () => {
      const root = makeRoot();

      write(root, LOCAL_CONFIG_FILE_NAME, { sdkSourcePath: './nope' });

      expect(diagnoseLocalConfig({ root })[0]).toContain('does not exist');
    });

    it('rejects a directory that is not an sdk checkout', () => {
      const root = makeRoot();

      mkdirSync(join(root, 'elsewhere'));
      write(root, LOCAL_CONFIG_FILE_NAME, { sdkSourcePath: './elsewhere' });

      expect(diagnoseLocalConfig({ root })[0]).toContain('is not an ethlete-sdk checkout');
    });

    it('rejects an empty value', () => {
      const root = makeRoot();

      write(root, LOCAL_CONFIG_FILE_NAME, { sdkSourcePath: '  ' });

      expect(diagnoseLocalConfig({ root })[0]).toContain('invalid "sdkSourcePath"');
    });
  });

  describe('apiRepoPaths', () => {
    it('accepts directories that exist', () => {
      const root = makeRoot();

      mkdirSync(join(root, 'api'));
      write(root, LOCAL_CONFIG_FILE_NAME, { apiRepoPaths: { hub: './api' } });

      expect(diagnoseLocalConfig({ root })).toEqual([]);
    });

    it('names the app whose path is missing', () => {
      const root = makeRoot();

      mkdirSync(join(root, 'api'));
      write(root, LOCAL_CONFIG_FILE_NAME, { apiRepoPaths: { hub: './api', shop: './shop' } });

      expect(diagnoseLocalConfig({ root })).toEqual([expect.stringContaining('"apiRepoPaths.shop"')]);
    });

    it('rejects a path that is a file', () => {
      const root = makeRoot();

      write(root, 'api.txt', '');
      write(root, LOCAL_CONFIG_FILE_NAME, { apiRepoPaths: { hub: './api.txt' } });

      expect(diagnoseLocalConfig({ root })[0]).toContain('is not a directory');
    });

    it('rejects a value that is not a map', () => {
      const root = makeRoot();

      write(root, LOCAL_CONFIG_FILE_NAME, { apiRepoPaths: '../backend' });

      expect(diagnoseLocalConfig({ root })[0]).toContain('mapping an app name');
    });
  });

  describe('apiRepoBranches', () => {
    it('accepts app-specific and fallback branches', () => {
      const root = makeRoot();

      write(root, LOCAL_CONFIG_FILE_NAME, { apiRepoBranches: { hub: 'develop', '*': 'main' } });

      expect(diagnoseLocalConfig({ root })).toEqual([]);
    });

    it('rejects an empty branch name', () => {
      const root = makeRoot();

      write(root, LOCAL_CONFIG_FILE_NAME, { apiRepoBranches: { hub: '' } });

      expect(diagnoseLocalConfig({ root })[0]).toContain('"apiRepoBranches.hub"');
    });
  });

  describe('the file the keys moved out of', () => {
    it('says where they went and still checks them', () => {
      const root = makeRoot();

      write(root, LEGACY_LOCAL_CONFIG_FILE_NAME, { apiRepoPaths: { hub: './missing' } });

      const problems = diagnoseLocalConfig({ root });

      expect(problems[0]).toContain(`${LEGACY_LOCAL_CONFIG_FILE_NAME} still holds "apiRepoPaths"`);
      expect(problems[0]).toContain(`move it to ${LOCAL_CONFIG_FILE_NAME}`);
      expect(problems[1]).toContain('does not exist');
    });

    it('ignores keys that legitimately live there', () => {
      const root = makeRoot();

      write(root, LEGACY_LOCAL_CONFIG_FILE_NAME, { disableHooks: true });

      expect(diagnoseLocalConfig({ root })).toEqual([]);
    });

    it('is not read once the new file exists', () => {
      const root = makeRoot();

      mkdirSync(join(root, 'api'));
      write(root, LOCAL_CONFIG_FILE_NAME, { apiRepoPaths: { hub: './api' } });
      write(root, LEGACY_LOCAL_CONFIG_FILE_NAME, { apiRepoPaths: { hub: './missing' } });

      expect(diagnoseLocalConfig({ root })).toEqual([]);
    });
  });
});
