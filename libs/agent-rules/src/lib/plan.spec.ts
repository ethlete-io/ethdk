import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { CONFIG_FILE_NAME, loadConfig, LOCAL_CONFIG_FILE_NAME } from './config';
import { ContentItem } from './load-content';
import { assertResolvedContentReferences, buildPlan } from './plan';

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

const contentItem = (options: { name: string; body?: string; resources?: string[] }): ContentItem => ({
  frontmatter: {
    name: options.name,
    description: options.name,
    kind: 'skill',
    scope: 'consumer',
    requires: [],
    paths: [],
    vars: [],
  },
  body: options.body ?? '',
  sourcePath: `/content/skills/${options.name}/SKILL.md`,
  resources: (options.resources ?? []).map((fileName) => ({ fileName, absolutePath: `/content/${fileName}` })),
});

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

  it('allows optional guides to be excluded when emitted content does not reference them', () => {
    const plan = planWithConfig({ exclude: ['story-styling', 'verify-in-storybook'] });
    const generated = plan.files.map((file) => file.contents).join('\n');

    expect(plan.skipped).toEqual(
      expect.arrayContaining([
        { name: 'story-styling', reason: 'excluded by config' },
        { name: 'verify-in-storybook', reason: 'excluded by config' },
      ]),
    );
    expect(generated).not.toContain('story-styling');
    expect(generated).not.toContain('verify-in-storybook');
  });

  it('rejects a required skill reference after filtering', () => {
    expect(() => planWithConfig({ exclude: ['sdk-source'] })).toThrow(
      'sdk-docs/SKILL.md: references package skill "sdk-source", but it is not emitted because excluded by config',
    );
  });
});

describe('content references', () => {
  it('rejects a resource that is not bundled with its skill', () => {
    const source = contentItem({ name: 'source', body: 'Read {%resource:missing.md%}.' });

    expect(() => assertResolvedContentReferences({ items: [source], kept: [source], skipped: [] })).toThrow(
      'references missing bundled resource "missing.md"',
    );
  });

  it('rejects a plain-text package skill reference', () => {
    const source = contentItem({ name: 'source', body: 'Read the `target` skill.' });
    const target = contentItem({ name: 'target' });

    expect(() =>
      assertResolvedContentReferences({ items: [source, target], kept: [source, target], skipped: [] }),
    ).toThrow('references package skill "target" as plain text');
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

describe('apiRepoBranches warnings', () => {
  it('accepts app-specific and explicit fallback branches', () => {
    const plan = planWithLocalConfig({ apiRepoBranches: { hub: 'develop', '*': 'main' } });

    expect(plan.warnings).toEqual([]);
  });

  it('rejects an empty branch name', () => {
    const plan = planWithLocalConfig({ apiRepoBranches: { hub: '' } });

    expect(plan.warnings).toEqual([expect.stringContaining('"apiRepoBranches.hub"')]);
  });
});
