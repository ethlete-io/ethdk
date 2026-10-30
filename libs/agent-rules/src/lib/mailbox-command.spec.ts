import { existsSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveContentRoot } from './load-content';
import { MAILBOX_SCRIPT, mailboxCommand } from './mailbox-command';

describe('mailboxCommand', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'mailbox-command-'));
    vi.stubEnv('AGENT_MAILBOX', join(dir, 'mailbox.jsonl'));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(dir, { recursive: true, force: true });
  });

  it('finds the bundled script', () => {
    expect(existsSync(join(resolveContentRoot(), MAILBOX_SCRIPT))).toBe(true);
  });

  it('passes the arguments to the script and returns its exit code', () => {
    expect(mailboxCommand({ argv: ['send', 'codex', 'hello'] })).toBe(0);
    expect(mailboxCommand({ argv: ['claim', 'codex', 'src/a'] })).toBe(0);
    expect(mailboxCommand({ argv: ['claim', 'gemini', 'src/a'] })).toBe(2);
  });
});
