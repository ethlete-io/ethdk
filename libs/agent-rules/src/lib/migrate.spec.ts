import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONFIG_FILE_NAME } from './config';
import { migrate } from './migrate';
import { END_MARKER, START_MARKER } from './render';

const fsState = vi.hoisted(() => ({ failSymlink: false }));

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();

  return {
    ...actual,
    symlinkSync: (...args: Parameters<typeof actual.symlinkSync>) => {
      if (fsState.failSymlink) throw new Error('EPERM');

      return actual.symlinkSync(...args);
    },
  };
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('migrate', () => {
  it('keeps a single marker block when CLAUDE.md and AGENTS.md both hold one', () => {
    const root = mkdtempSync(join(tmpdir(), 'agent-rules-migrate-'));
    const block = `${START_MARKER}\nold-generated-text\n${END_MARKER}`;

    writeFileSync(join(root, CONFIG_FILE_NAME), JSON.stringify({ targets: ['claude'] }), 'utf8');
    writeFileSync(join(root, 'package.json'), JSON.stringify({ dependencies: {} }), 'utf8');
    writeFileSync(join(root, 'CLAUDE.md'), `# Claude notes\n\n${block}\n`, 'utf8');
    writeFileSync(join(root, 'AGENTS.md'), `# Agents\n\n${block}\n`, 'utf8');
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    migrate({ root });

    const agents = readFileSync(join(root, 'AGENTS.md'), 'utf8');

    expect(agents.split(START_MARKER)).toHaveLength(2);
    expect(agents).toContain('# Claude notes');
    expect(agents).not.toContain('old-generated-text');
    expect(readFileSync(join(root, 'CLAUDE.md'), 'utf8')).toBe('@AGENTS.md\n');
  });

  it('moves a hand-written skill back when the symlink cannot be created', () => {
    const root = mkdtempSync(join(tmpdir(), 'agent-rules-migrate-'));

    writeFileSync(join(root, CONFIG_FILE_NAME), JSON.stringify({ targets: ['claude'] }), 'utf8');
    writeFileSync(join(root, 'package.json'), JSON.stringify({ dependencies: {} }), 'utf8');
    mkdirSync(join(root, '.claude/skills/mine'), { recursive: true });
    writeFileSync(join(root, '.claude/skills/mine/SKILL.md'), 'skill', 'utf8');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    fsState.failSymlink = true;

    try {
      migrate({ root });
    } finally {
      fsState.failSymlink = false;
    }

    expect(lstatSync(join(root, '.claude/skills/mine')).isDirectory()).toBe(true);
    expect(readFileSync(join(root, '.claude/skills/mine/SKILL.md'), 'utf8')).toBe('skill');
    expect(existsSync(join(root, '.agents/skills/mine'))).toBe(false);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('creating the symlink failed (EPERM)'));
  });

  it('fails on a malformed config before touching CLAUDE.md', () => {
    const root = mkdtempSync(join(tmpdir(), 'agent-rules-migrate-'));

    writeFileSync(join(root, CONFIG_FILE_NAME), '{"targets": ["claude"],}', 'utf8');
    writeFileSync(join(root, 'package.json'), JSON.stringify({ dependencies: {} }), 'utf8');
    writeFileSync(join(root, 'CLAUDE.md'), '# Notes\n', 'utf8');
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    expect(() => migrate({ root })).toThrow(CONFIG_FILE_NAME);
    expect(readFileSync(join(root, 'CLAUDE.md'), 'utf8')).toBe('# Notes\n');
  });

  it('does not overwrite the target of a CLAUDE.md symlink', () => {
    const root = mkdtempSync(join(tmpdir(), 'agent-rules-migrate-'));

    writeFileSync(join(root, CONFIG_FILE_NAME), JSON.stringify({ targets: ['claude'] }), 'utf8');
    writeFileSync(join(root, 'package.json'), JSON.stringify({ dependencies: {} }), 'utf8');
    writeFileSync(join(root, 'OTHER.md'), '# Other\n', 'utf8');
    symlinkSync('OTHER.md', join(root, 'CLAUDE.md'));
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    migrate({ root });

    expect(readFileSync(join(root, 'OTHER.md'), 'utf8')).toBe('# Other\n');
  });
});
