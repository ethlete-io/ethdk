import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { ContentItem } from '../load-content';
import { BANNER, END_MARKER, renderBody, START_MARKER } from '../render';
import { emitAgentsSkills } from './agents-skills';
import { emitClaude } from './claude';
import { emitCodex } from './codex';
import { emitCopilot } from './copilot';
import { emitCursor } from './cursor';
import { EmitContext, yamlString } from './shared';

const item = (options: {
  name: string;
  kind: 'rule' | 'skill';
  body: string;
  description?: string;
  paths?: string[];
  modelInvocation?: boolean;
  resources?: { fileName: string; absolutePath: string }[];
}): ContentItem => ({
  frontmatter: {
    name: options.name,
    description: options.description ?? `${options.name} description`,
    kind: options.kind,
    scope: 'both',
    requires: [],
    paths: options.paths ?? [],
    vars: [],
    modelInvocation: options.modelInvocation ?? true,
  },
  body: options.body,
  sourcePath: `/content/${options.name}.md`,
  resources: options.resources ?? [],
});

const context = (overrides: Partial<EmitContext> = {}): EmitContext => ({
  rules: [item({ name: 'style', kind: 'rule', body: 'See {% skill:theming %} for {% tool %}.' })],
  skills: [item({ name: 'theming', kind: 'skill', body: 'Read {% resource:tokens.md %}.' })],
  vars: { tool: 'npx', list: ['a', 'b'] },
  claudeMdImportsAgentsMd: false,
  hooks: [],
  ...overrides,
});

describe('emitClaude', () => {
  it('writes rules and namespaced skills with Claude link syntax', () => {
    const files = emitClaude(context());

    expect(files.map((file) => file.path)).toEqual([
      '.claude/rules/ethlete/style.md',
      '.claude/skills/ethlete-theming/SKILL.md',
    ]);
    expect(files[0]?.contents).toBe(`${BANNER}\n\nSee the **\`ethlete-theming\`** skill for npx.\n`);
    expect(files[1]?.contents).toBe(
      [
        '---',
        'name: ethlete-theming',
        'description: "theming description"',
        '---',
        '',
        BANNER,
        '',
        'Read `tokens.md` (bundled next to this skill).',
        '',
      ].join('\n'),
    );
  });

  it('scopes a rule with paths through frontmatter', () => {
    const rules = [item({ name: 'css', kind: 'rule', body: 'x', paths: ['**/*.css', '**/*.scss'] })];
    const [file] = emitClaude(context({ rules, skills: [] }));

    expect(file?.contents.startsWith("---\npaths:\n  - '**/*.css'\n  - '**/*.scss'\n---\n\n")).toBe(true);
  });

  it('skips the rules when CLAUDE.md imports AGENTS.md, but keeps the skills', () => {
    const files = emitClaude(context({ claudeMdImportsAgentsMd: true }));

    expect(files.map((file) => file.path)).toEqual(['.claude/skills/ethlete-theming/SKILL.md']);
  });

  it('marks a skill only the user may start', () => {
    const skills = [item({ name: 'manual', kind: 'skill', body: 'x', modelInvocation: false })];
    const [file] = emitClaude(context({ rules: [], skills }));

    expect(file?.contents).toContain('\ndisable-model-invocation: true\n---\n');
  });
});

describe('emitCursor', () => {
  it('writes an alwaysApply .mdc rule with .agents/skills links', () => {
    const [file] = emitCursor(context());

    expect(file?.path).toBe('.cursor/rules/ethlete-style.mdc');
    expect(file?.contents).toBe(
      [
        '---',
        'description: "style description"',
        'globs:',
        'alwaysApply: true',
        '---',
        '',
        BANNER,
        '',
        'See `.agents/skills/ethlete-theming/SKILL.md` for npx.',
        '',
      ].join('\n'),
    );
  });

  it('joins paths into globs', () => {
    const rules = [item({ name: 'css', kind: 'rule', body: 'x', paths: ['**/*.css', '**/*.scss'] })];

    expect(emitCursor(context({ rules }))[0]?.contents).toContain('\nglobs: **/*.css,**/*.scss\n');
  });

  it('emits no skills of its own', () => {
    expect(emitCursor(context({ rules: [] }))).toEqual([]);
  });
});

describe('emitCodex', () => {
  it('inlines the rules into a marker block in AGENTS.md and keeps the repo text', () => {
    const [file] = emitCodex({ context: context(), existing: '# Repo\n' });

    expect(file?.path).toBe('AGENTS.md');
    expect(file?.contents.startsWith(`# Repo\n\n${START_MARKER}\n${BANNER}\n\nSee \`.agents/skills/`)).toBe(true);
    expect(file?.contents).toContain('## Ethlete skills');
    expect(file?.contents.endsWith(`${END_MARKER}\n`)).toBe(true);
  });

  it('leaves out the skills hint when there are no skills', () => {
    const [file] = emitCodex({ context: context({ skills: [] }), existing: '' });

    expect(file?.contents).not.toContain('## Ethlete skills');
    expect(file?.contents.startsWith(START_MARKER)).toBe(true);
  });

  it('is stable across a second sync', () => {
    const [first] = emitCodex({ context: context(), existing: '# Repo\n\nOwn text\n' });
    const [second] = emitCodex({ context: context(), existing: first?.contents ?? '' });

    expect(second?.contents).toBe(first?.contents);
  });
});

describe('emitCopilot', () => {
  it('writes the rules into copilot-instructions.md and no skills hint', () => {
    const [file] = emitCopilot({ context: context(), existing: '' });

    expect(file?.path).toBe('.github/copilot-instructions.md');
    expect(file?.contents).toBe(
      `${START_MARKER}\n${BANNER}\n\nSee \`.agents/skills/ethlete-theming/SKILL.md\` for npx.\n${END_MARKER}\n`,
    );
  });
});

describe('emitAgentsSkills', () => {
  it('bundles each skill with its resources, interpolating vars into them', () => {
    const dir = mkdtempSync(join(tmpdir(), 'agent-rules-targets-'));
    const absolutePath = join(dir, 'tokens.md');

    writeFileSync(absolutePath, 'Run {% tool %}.\n', 'utf8');

    const skills = [
      item({
        name: 'theming',
        kind: 'skill',
        body: 'Read {% resource:tokens.md %}.',
        resources: [{ fileName: 'tokens.md', absolutePath }],
      }),
    ];
    const files = emitAgentsSkills(context({ skills }));

    expect(files.map((file) => file.path)).toEqual([
      '.agents/skills/ethlete-theming/SKILL.md',
      '.agents/skills/ethlete-theming/tokens.md',
    ]);
    expect(files[0]?.contents).toContain('Read `.agents/skills/ethlete-theming/tokens.md`.');
    expect(files[1]?.contents).toBe('Run npx.\n');
  });
});

describe('renderBody', () => {
  const links = {
    skill: (name: string) => `<skill ${name}>`,
    resource: (target: { skillName: string; fileName: string }) => `<${target.skillName}/${target.fileName}>`,
  };
  const render = (body: string, vars: Record<string, string | string[]> = {}) =>
    renderBody({ item: item({ name: 'x', kind: 'skill', body }), vars, links });

  it('leaves Angular interpolation alone', () => {
    expect(render('{{ count() }}')).toBe('{{ count() }}');
  });

  it('renders a list variable as code spans', () => {
    expect(render('{%list%} and {%  list  %}', { list: ['a', 'b'] })).toBe('`a`, `b` and `a`, `b`');
  });

  it('throws on a variable with no value, naming the item', () => {
    expect(() => render('{% missing %}')).toThrow('x: no value for template token "{% missing %}".');
  });

  it('throws on a link without a target rather than reading it as a variable', () => {
    expect(() => render('{% skill %}')).toThrow('no value for template token "{% skill %}"');
  });

  it('throws on a token the pattern cannot read', () => {
    expect(() => render('{% two words %}')).toThrow('x: unresolved template token "{% two words %}".');
  });
});

describe('yamlString', () => {
  it('escapes quotes and backslashes', () => {
    expect(yamlString('say "hi" \\ bye')).toBe('"say \\"hi\\" \\\\ bye"');
  });
});
