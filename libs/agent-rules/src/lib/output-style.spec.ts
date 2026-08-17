import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import {
  applyOutputStylePlan,
  availableOutputStyles,
  DEFAULT_OUTPUT_STYLE,
  planOutputStyle,
  resolveClaudeConfigDir,
} from './output-style';

const configDir = (settings?: unknown) => {
  const dir = mkdtempSync(join(tmpdir(), 'agent-rules-output-style-'));

  if (settings !== undefined) writeFileSync(join(dir, 'settings.json'), JSON.stringify(settings), 'utf8');

  return dir;
};

const writeStyle = (dir: string, name: string, contents: string) => {
  mkdirSync(join(dir, 'output-styles'), { recursive: true });
  writeFileSync(join(dir, 'output-styles', `${name}.md`), contents, 'utf8');
};

const install = (dir: string, options: { force?: boolean; remove?: boolean } = {}) => {
  const plan = planOutputStyle({ configDir: dir, ...options });

  applyOutputStylePlan(plan);

  return plan;
};

const readSettings = (dir: string) =>
  JSON.parse(readFileSync(join(dir, 'settings.json'), 'utf8')) as { outputStyle?: string };

const readStyle = (dir: string, name = DEFAULT_OUTPUT_STYLE) =>
  readFileSync(join(dir, 'output-styles', `${name}.md`), 'utf8');

describe('availableOutputStyles', () => {
  it('lists the styles the package ships', () => {
    expect(availableOutputStyles()).toContain(DEFAULT_OUTPUT_STYLE);
  });
});

describe('resolveClaudeConfigDir', () => {
  it('prefers the explicit path over the environment', () => {
    expect(resolveClaudeConfigDir('/tmp/elsewhere')).toBe('/tmp/elsewhere');
  });

  it('falls back to the home directory', () => {
    expect(resolveClaudeConfigDir()).toMatch(/\.claude$/);
  });
});

describe('planOutputStyle', () => {
  it('writes the style and activates it', () => {
    const dir = configDir();
    const plan = install(dir);

    expect(plan.files.map((file) => file.action)).toEqual(['create', 'create']);
    expect(readStyle(dir)).toContain('# ASD-STE100 output style');
    expect(readStyle(dir)).toMatch(/^---\nname: ste-clarity/);
    expect(readSettings(dir).outputStyle).toBe(DEFAULT_OUTPUT_STYLE);
  });

  it('keeps every other setting', () => {
    const dir = configDir({ model: 'opus', permissions: { allow: ['Bash'] } });

    install(dir);

    expect(readSettings(dir)).toEqual({
      model: 'opus',
      permissions: { allow: ['Bash'] },
      outputStyle: DEFAULT_OUTPUT_STYLE,
    });
  });

  it('plans nothing the second time', () => {
    const dir = configDir();

    install(dir);

    expect(planOutputStyle({ configDir: dir }).files).toEqual([]);
  });

  it('leaves settings alone when activation is off', () => {
    const dir = configDir();
    const plan = planOutputStyle({ configDir: dir, activate: false });

    applyOutputStylePlan(plan);

    expect(plan.files.map((file) => file.path)).toEqual([join(dir, 'output-styles', `${DEFAULT_OUTPUT_STYLE}.md`)]);
    expect(existsSync(join(dir, 'settings.json'))).toBe(false);
  });

  it('refuses to overwrite a style someone else wrote', () => {
    const dir = configDir();

    writeStyle(dir, DEFAULT_OUTPUT_STYLE, '---\nname: ste-clarity\n---\n\nMy own rules.\n');

    const plan = planOutputStyle({ configDir: dir });

    expect(plan.conflict).toContain('--force');
    expect(plan.files).toEqual([]);
  });

  it('overwrites it with --force', () => {
    const dir = configDir();

    writeStyle(dir, DEFAULT_OUTPUT_STYLE, '---\nname: ste-clarity\n---\n\nMy own rules.\n');
    install(dir, { force: true });

    expect(readStyle(dir)).toContain('# ASD-STE100 output style');
  });

  it('adopts a copy that differs only in layout', () => {
    const dir = configDir();
    const shipped = planOutputStyle({ configDir: dir }).files[0]?.contents ?? '';
    const unformatted = shipped
      .replace(/^<!-- @ethlete.*$/m, '')
      .replace(/-{3,}/g, '---')
      .replace(/ {2,}/g, ' ');

    writeStyle(dir, DEFAULT_OUTPUT_STYLE, unformatted);

    const plan = planOutputStyle({ configDir: dir });

    expect(plan.conflict).toBeNull();
    expect(plan.files.map((file) => file.action)).toEqual(['update', 'create']);
  });

  it('reports the style Claude Code uses now', () => {
    const dir = configDir({ outputStyle: 'Explanatory' });

    expect(planOutputStyle({ configDir: dir }).activeStyle).toBe('Explanatory');
  });

  it('names the styles it ships when the name is unknown', () => {
    expect(() => planOutputStyle({ configDir: configDir(), name: 'nope' })).toThrow(
      `Unknown output style "nope". This package ships: ${availableOutputStyles().join(', ')}.`,
    );
  });

  it('refuses to touch settings.json it cannot parse', () => {
    const dir = configDir();

    writeFileSync(join(dir, 'settings.json'), '{ not json', 'utf8');

    expect(() => planOutputStyle({ configDir: dir })).toThrow('is not valid JSON');
  });
});

describe('planOutputStyle --remove', () => {
  it('deletes the file and clears the setting', () => {
    const dir = configDir({ model: 'opus' });

    install(dir);
    install(dir, { remove: true });

    expect(existsSync(join(dir, 'output-styles', `${DEFAULT_OUTPUT_STYLE}.md`))).toBe(false);
    expect(readSettings(dir)).toEqual({ model: 'opus' });
  });

  it('keeps a setting that points at another style', () => {
    const dir = configDir({ outputStyle: 'Explanatory' });

    install(dir, { remove: true });

    expect(readSettings(dir).outputStyle).toBe('Explanatory');
  });

  it('plans nothing when it was never installed', () => {
    expect(planOutputStyle({ configDir: configDir(), remove: true }).files).toEqual([]);
  });

  it('refuses to delete a style someone else wrote', () => {
    const dir = configDir();

    writeStyle(dir, DEFAULT_OUTPUT_STYLE, '---\nname: ste-clarity\n---\n\nMy own rules.\n');

    expect(planOutputStyle({ configDir: dir, remove: true }).conflict).toContain('delete');
  });
});
