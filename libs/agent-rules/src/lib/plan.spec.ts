import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { CONFIG_FILE_NAME, loadConfig, LOCAL_CONFIG_FILE_NAME, TOPOLOGY_CONFIG_FILE_NAME } from './config';
import { ContentItem } from './load-content';
import { assertResolvedContentReferences, buildPlan, claudeMdImportsAgentsMd } from './plan';

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
    modelInvocation: true,
  },
  body: options.body ?? '',
  sourcePath: `/content/skills/${options.name}/SKILL.md`,
  resources: (options.resources ?? []).map((fileName) => ({ fileName, absolutePath: `/content/${fileName}` })),
});

describe('exclude warnings', () => {
  it('accepts the name of a packaged skill', () => {
    const plan = planWithConfig({ exclude: ['timetrack'] });

    expect(plan.warnings).toEqual([]);
    expect(plan.skipped).toContainEqual({ name: 'timetrack', cause: 'excluded', reason: 'excluded by config' });
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
        { name: 'story-styling', cause: 'excluded', reason: 'excluded by config' },
        { name: 'verify-in-storybook', cause: 'excluded', reason: 'excluded by config' },
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

describe('moved local config keys', () => {
  it('tells the developer where the key went instead of calling it unsupported', () => {
    const plan = planWithLocalConfig({ apiRepoPaths: { hub: './api' } });

    expect(plan.warnings).toEqual([expect.stringContaining('still holds "apiRepoPaths"')]);
    expect(plan.warnings[0]).toContain(TOPOLOGY_CONFIG_FILE_NAME);
  });

  it('still reports a key that belongs nowhere', () => {
    const plan = planWithLocalConfig({ apiRepoPath: './api' });

    expect(plan.warnings[0]).toContain('unsupported key(s): apiRepoPath');
    expect(plan.warnings[0]).toContain('"disableHooks"');
  });
});

describe('plan warnings', () => {
  it('reports a prototype key as an unknown disabled hook', () => {
    const plan = planWithLocalConfig({ disableHooks: ['constructor'] });

    expect(plan.warnings).toEqual([expect.stringContaining('disables unknown hook(s): constructor')]);
  });

  it('accepts an absolute themeStylesheet that exists', () => {
    const stylesheet = join(mkdtempSync(join(tmpdir(), 'agent-rules-theme-')), 'theme.css');

    writeFileSync(stylesheet, '', 'utf8');

    expect(planWithConfig({ vars: { themeStylesheet: stylesheet } }).warnings).toEqual([]);
  });
});

describe('config file checks', () => {
  it('names the config file when it does not parse', () => {
    const root = mkdtempSync(join(tmpdir(), 'agent-rules-plan-'));

    writeFileSync(join(root, CONFIG_FILE_NAME), '{ "vars": { "a": 1 } "exclude": [] }', 'utf8');

    expect(() => loadConfig({ root })).toThrow(new RegExp(`^${CONFIG_FILE_NAME}: `));
  });

  it('warns about an unknown top-level key', () => {
    expect(planWithConfig({ exlude: ['x'] }).warnings).toEqual([
      expect.stringContaining(`${CONFIG_FILE_NAME} has unknown key(s): exlude`),
    ]);
  });

  it('warns when a command var names a script package.json does not have', () => {
    const root = mkdtempSync(join(tmpdir(), 'agent-rules-plan-'));

    writeFileSync(join(root, 'package.json'), JSON.stringify({ scripts: { lint: 'eslint .' } }), 'utf8');
    writeFileSync(join(root, CONFIG_FILE_NAME), JSON.stringify({ vars: { lintCommand: 'npm run lint:all' } }), 'utf8');

    expect(buildPlan({ config: loadConfig({ root }) }).warnings).toEqual([
      expect.stringContaining('vars.lintCommand is `npm run lint:all`, but package.json has no "lint:all" script'),
    ]);
  });
});

describe('hook config checks', () => {
  it('rejects a prototype key as a hook or git hook name', () => {
    expect(() => planWithConfig({ hooks: ['constructor'] })).toThrow('Unknown hook(s): constructor');
    expect(() => planWithConfig({ gitHooks: ['toString'] })).toThrow('Unknown git hook(s): toString');
  });

  it('warns when the hook settings file does not parse', () => {
    const root = mkdtempSync(join(tmpdir(), 'agent-rules-plan-'));

    mkdirSync(join(root, '.claude'));
    writeFileSync(join(root, '.claude', 'settings.json'), '{ broken', 'utf8');
    writeFileSync(join(root, CONFIG_FILE_NAME), JSON.stringify({ targets: ['claude'] }), 'utf8');

    expect(buildPlan({ config: loadConfig({ root }) }).warnings).toEqual([
      expect.stringContaining('.claude/settings.json is not valid JSON'),
    ]);
  });
});

describe('claudeMdImportsAgentsMd', () => {
  const rootWith = (claudeMd: string) => {
    const root = mkdtempSync(join(tmpdir(), 'agent-rules-claude-md-'));

    writeFileSync(join(root, 'CLAUDE.md'), claudeMd, 'utf8');

    return root;
  };

  const rootWithLink = (target: string) => {
    const root = mkdtempSync(join(tmpdir(), 'agent-rules-claude-md-'));

    mkdirSync(join(root, 'other'));
    writeFileSync(join(root, 'other', 'AGENTS.md'), '', 'utf8');
    writeFileSync(join(root, 'AGENTS.md'), '', 'utf8');
    writeFileSync(join(root, 'OLD-AGENTS.md'), '', 'utf8');
    symlinkSync(target, join(root, 'CLAUDE.md'));

    return root;
  };

  it('accepts the import line and a link to the root AGENTS.md', () => {
    expect(claudeMdImportsAgentsMd(rootWith('@AGENTS.md\n'))).toBe(true);
    expect(claudeMdImportsAgentsMd(rootWithLink('AGENTS.md'))).toBe(true);
    expect(claudeMdImportsAgentsMd(rootWithLink('./AGENTS.md'))).toBe(true);
  });

  it('rejects a link to another AGENTS.md', () => {
    expect(claudeMdImportsAgentsMd(rootWithLink('other/AGENTS.md'))).toBe(false);
    expect(claudeMdImportsAgentsMd(rootWithLink('OLD-AGENTS.md'))).toBe(false);
  });

  it('ignores an import line inside a code fence', () => {
    expect(claudeMdImportsAgentsMd(rootWith('# Notes\n\n```md\n@AGENTS.md\n```\n'))).toBe(false);
    expect(claudeMdImportsAgentsMd(rootWith('```md\nx\n```\n\n@AGENTS.md\n'))).toBe(true);
  });
});
