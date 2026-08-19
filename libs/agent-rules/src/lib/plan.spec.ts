import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { CONFIG_FILE_NAME, loadConfig, LOCAL_CONFIG_FILE_NAME } from './config';
import { buildPlan } from './plan';

const planWithLocalConfig = (contents: unknown) => {
  const root = mkdtempSync(join(tmpdir(), 'agent-rules-plan-'));

  mkdirSync(join(root, 'api'));
  writeFileSync(join(root, LOCAL_CONFIG_FILE_NAME), JSON.stringify(contents), 'utf8');

  return buildPlan({ config: loadConfig({ root }) });
};

const planWithConfig = (contents: unknown) => {
  const root = mkdtempSync(join(tmpdir(), 'agent-rules-plan-'));

  writeFileSync(join(root, CONFIG_FILE_NAME), JSON.stringify(contents), 'utf8');

  return buildPlan({ config: loadConfig({ root }) });
};

describe('exclude warnings', () => {
  it('accepts the name of a packaged skill', () => {
    const plan = planWithConfig({ exclude: ['timetrack'] });

    expect(plan.warnings).toEqual([]);
    expect(plan.skipped).toContainEqual({ name: 'timetrack', reason: 'excluded by config' });
  });

  it('warns about names that do not match packaged content', () => {
    const plan = planWithConfig({ exclude: ['git-fow', 'missing-rule'] });

    expect(plan.warnings).toEqual([expect.stringContaining('excludes unknown content name(s): git-fow, missing-rule')]);
  });
});

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
