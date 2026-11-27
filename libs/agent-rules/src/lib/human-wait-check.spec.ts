import { execFileSync } from 'child_process';
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { describe, expect, it } from 'vitest';

const hookPath = resolve(__dirname, '../../content/hooks/human-wait-check.py');
const fixtureDir = resolve(__dirname, 'fixtures/human-wait-check');

const QUEUE = [
  '| ID | Zeile | Ziel | Stand | Wer |',
  '| --- | --- | --- | --- | --- |',
  '| B1 | Freie Scheibe | Ziel | Offen: alles. | Builder |',
  '| B2 | Wartende Scheibe | Ziel | Wartet auf den Merge. | Builder |',
  '',
].join('\n');

type RunOptions = {
  transcript: string;
  handoff?: boolean;
  queue?: string;
  localConfig?: Record<string, unknown>;
  stopHookActive?: boolean;
  tmuxSessions?: string[];
};

const runHook = (options: RunOptions) => {
  const { transcript, handoff = false, queue, localConfig, stopHookActive = false, tmuxSessions = [] } = options;
  const parent = mkdtempSync(join(tmpdir(), 'agent-rules-human-wait-'));
  const root = join(parent, 'repo');

  mkdirSync(root);

  if (queue) {
    mkdirSync(join(root, 'plans'));
    writeFileSync(join(root, 'plans', 'QUEUE.md'), queue, 'utf8');
  }

  if (handoff) {
    mkdirSync(join(root, '.claude', 'handoffs'), { recursive: true });
    copyFileSync(
      join(fixtureDir, 'handoffs', 'coordinator-1.md'),
      join(root, '.claude', 'handoffs', 'coordinator-1.md'),
    );
  }

  if (localConfig) {
    writeFileSync(join(root, 'ethlete-agents.config.local.json'), JSON.stringify(localConfig), 'utf8');
  }

  const bin = join(parent, 'bin');
  mkdirSync(bin);
  writeFileSync(
    join(bin, 'tmux'),
    `#!/bin/sh\nprintf '%s\\n' ${tmuxSessions.map((name) => `'${name}'`).join(' ')}\n`,
    'utf8',
  );
  chmodSync(join(bin, 'tmux'), 0o755);

  const output = execFileSync('python3', [hookPath, '--agent', 'claude'], {
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: root, PATH: `${bin}:${process.env['PATH']}` },
    input: JSON.stringify({
      cwd: root,
      hook_event_name: 'Stop',
      transcript_path: join(fixtureDir, `${transcript}.jsonl`),
      stop_hook_active: stopHookActive,
    }),
  });

  return output.trim() ? (JSON.parse(output) as { decision: string; reason: string }) : null;
};

describe('human-wait-check', () => {
  it('blocks a coordinator turn that ends with a `!` command for the human while its handoff lists a next slice', () => {
    const result = runHook({ transcript: 'asks-command', handoff: true });

    expect(result?.decision).toBe('block');
    expect(result?.reason).toContain('.claude/handoffs/coordinator-1.md');
    expect(result?.reason).toContain('2. Spawn slice 3 (libs/shared)');
    expect(result?.reason).toContain('0 of 4 slots');
    expect(result?.reason).toContain('propose a permission rule');
  });

  it('blocks a turn that ends with a question while the queue has a free row, and names only that row', () => {
    const result = runHook({ transcript: 'asks-question', queue: QUEUE });

    expect(result?.decision).toBe('block');
    expect(result?.reason).toContain('B1 (Freie Scheibe)');
    expect(result?.reason).not.toContain('B2');
  });

  it('stays silent when the turn asks the human nothing, even with free work', () => {
    expect(runHook({ transcript: 'no-question', handoff: true, queue: QUEUE })).toBeNull();
  });

  it('stays silent when no queue and no resumed handoff list free work', () => {
    expect(runHook({ transcript: 'asks-command' })).toBeNull();
  });

  it('stays silent when every queue row waits and there is no handoff', () => {
    const waiting = QUEUE.split('\n')
      .filter((line) => !line.startsWith('| B1'))
      .join('\n');

    expect(runHook({ transcript: 'asks-question', queue: waiting })).toBeNull();
  });

  it('stays silent when the running work fills the slot limit', () => {
    expect(
      runHook({
        transcript: 'asks-command',
        handoff: true,
        localConfig: { builderSlots: 1 },
        tmuxSessions: ['codex-slice-3@repo'],
      }),
    ).toBeNull();
  });

  it('stays silent in a session whose role is not configured', () => {
    expect(
      runHook({ transcript: 'asks-command', handoff: true, localConfig: { builderIdle: { roles: ['builder'] } } }),
    ).toBeNull();
  });

  it('fires once per stop chain', () => {
    expect(runHook({ transcript: 'asks-command', handoff: true, stopHookActive: true })).toBeNull();
  });

  it('can be disabled per machine', () => {
    expect(
      runHook({ transcript: 'asks-command', handoff: true, localConfig: { disableHooks: ['human-wait-check'] } }),
    ).toBeNull();
  });
});
