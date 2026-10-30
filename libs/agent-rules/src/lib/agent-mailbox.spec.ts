import { spawnSync } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const SCRIPT = join(__dirname, '../../content/skills/agent-mailbox/agent-mailbox.mjs');

describe('agent-mailbox', () => {
  let dir: string;

  const run = (args: string[], input?: string) =>
    spawnSync('node', [SCRIPT, ...args], {
      cwd: dir,
      input,
      encoding: 'utf8',
      env: { ...process.env, AGENT_MAILBOX: join(dir, 'mailbox.jsonl') },
    });

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'agent-mailbox-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('sends a message from the arguments and reads it back', () => {
    run(['send', 'codex', 'hello', 'there']);

    expect(run(['read']).stdout).toMatch(/codex: hello there\n$/);
  });

  it('sends a multi-line message from stdin', () => {
    run(['send', 'codex'], 'line one\nline two\n');

    expect(run(['read']).stdout).toContain('codex: line one\nline two');
  });

  it('limits read to the last messages unless --all is given', () => {
    for (const n of [1, 2, 3]) run(['send', 'codex', `m${n}`]);

    expect(run(['read', '--last', '1']).stdout).toMatch(/m3/);
    expect(run(['read', '--last', '1']).stdout).not.toMatch(/m2/);
    expect(run(['read', '--all']).stdout).toMatch(/m1/);
  });

  it('lists a claim and refuses an overlapping claim from another sender', () => {
    run(['claim', 'codex', 'src/a']);

    expect(run(['claims']).stdout).toContain('src/a  codex');

    const conflict = run(['claim', 'claude', 'src/a/file.ts']);

    expect(conflict.status).toBe(2);
    expect(conflict.stderr).toContain('Claimed by codex');
    expect(run(['claim', 'claude', 'src/a/file.ts', '--force']).status).toBe(0);
  });

  it('drops a claim after release and after expiry', () => {
    run(['claim', 'codex', 'src/a']);
    run(['release', 'codex', 'src/a']);

    expect(run(['claims']).stdout).toBe('No active claims.\n');

    run(['claim', 'codex', 'src/b', '--ttl', '0']);

    expect(run(['claims']).stdout).toBe('No active claims.\n');
  });

  it('releases every claim of a sender when no path is given', () => {
    run(['claim', 'codex', 'src/a', 'src/b']);
    run(['release', 'codex']);

    expect(run(['claims']).stdout).toBe('No active claims.\n');
  });
});
