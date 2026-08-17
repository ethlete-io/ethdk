import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { loadConfig, LOCAL_CONFIG_FILE_NAME } from './config';
import { buildPlan } from './plan';

const planWithLocalConfig = (contents: unknown) => {
  const root = mkdtempSync(join(tmpdir(), 'agent-rules-plan-'));

  mkdirSync(join(root, 'api'));
  writeFileSync(join(root, LOCAL_CONFIG_FILE_NAME), JSON.stringify(contents), 'utf8');

  return buildPlan({ config: loadConfig({ root }) });
};

describe('apiRepoPaths warnings', () => {
  it('accepts a map of app names to directories that exist', () => {
    const plan = planWithLocalConfig({ apiRepoPaths: { hub: './api' } });

    expect(plan.warnings).toEqual([]);
  });

  it('names the app whose path is missing', () => {
    const plan = planWithLocalConfig({ apiRepoPaths: { hub: './api', shop: './shop-api' } });

    expect(plan.warnings).toEqual([expect.stringContaining('"apiRepoPaths.shop"')]);
    expect(plan.warnings[0]).toContain('does not exist');
  });

  it('rejects a path that is a file', () => {
    const root = mkdtempSync(join(tmpdir(), 'agent-rules-plan-'));

    writeFileSync(join(root, 'api.txt'), '', 'utf8');
    writeFileSync(join(root, LOCAL_CONFIG_FILE_NAME), JSON.stringify({ apiRepoPaths: { hub: './api.txt' } }), 'utf8');

    expect(buildPlan({ config: loadConfig({ root }) }).warnings).toEqual([
      expect.stringContaining('is not a directory'),
    ]);
  });

  it('rejects a value that is not a map', () => {
    const plan = planWithLocalConfig({ apiRepoPaths: '../fut-hub-backend' });

    expect(plan.warnings).toEqual([expect.stringContaining('mapping an app name')]);
  });

  it('reports the key as supported', () => {
    const plan = planWithLocalConfig({ apiRepoPath: './api' });

    expect(plan.warnings[0]).toContain('unsupported key(s): apiRepoPath');
    expect(plan.warnings[0]).toContain('"apiRepoPaths"');
  });
});
