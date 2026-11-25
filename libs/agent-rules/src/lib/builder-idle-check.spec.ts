import { execFileSync } from 'child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { describe, expect, it } from 'vitest';

const hookPath = resolve(__dirname, '../../content/hooks/builder-idle-check.py');
const fixture = (name: string) => resolve(__dirname, 'fixtures/builder-idle-check', `${name}.jsonl`);

const QUEUE = [
  '# Warteschlange',
  '',
  '| ID | Zeile | Ziel | Stand | Wer |',
  '| --- | --- | --- | --- | --- |',
  '| B1 | Offene Arbeit | Ziel | Gebaut: Teil 1. Offen: Teil 2. | Builder |',
  '| B2 | Wartende Arbeit | Ziel | Gebaut. Wartet auf den Merge durch den Menschen. | Builder |',
  '| B3 | Nur Merge | Ziel | Offen nur: Merge durch den Menschen. | Builder |',
  '| B4 | Menschen-Zeile | Ziel | Offen: Entscheidung. | Mensch |',
  '',
].join('\n');

type RunOptions = {
  transcript: string;
  stopHookActive?: boolean;
  queue?: string;
  localConfig?: Record<string, unknown>;
};

const runHook = (options: RunOptions) => {
  const { transcript, stopHookActive = false, queue = QUEUE, localConfig } = options;
  const root = mkdtempSync(join(tmpdir(), 'agent-rules-builder-idle-'));

  mkdirSync(join(root, 'plans'));
  writeFileSync(join(root, 'plans', 'QUEUE.md'), queue, 'utf8');

  if (localConfig) {
    writeFileSync(join(root, 'ethlete-agents.config.local.json'), JSON.stringify(localConfig), 'utf8');
  }

  const output = execFileSync('python3', [hookPath, '--agent', 'claude'], {
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: root },
    input: JSON.stringify({
      cwd: root,
      hook_event_name: 'Stop',
      transcript_path: fixture(transcript),
      stop_hook_active: stopHookActive,
    }),
  });

  return output.trim() ? (JSON.parse(output) as { decision: string; reason: string }) : null;
};

describe('builder-idle-check', () => {
  it('blocks an idle builder stop with every task done, and names only the open Builder rows', () => {
    const result = runHook({ transcript: 'idle-all-done' });

    expect(result?.decision).toBe('block');
    expect(result?.reason).toContain('B1 (Offene Arbeit)');
    expect(result?.reason).not.toContain('B2');
    expect(result?.reason).not.toContain('B3');
    expect(result?.reason).not.toContain('B4');
    expect(result?.reason).toContain('"wartet auf" or "Offen nur:"');
  });

  it('stays silent while a subagent still runs', () => {
    expect(runHook({ transcript: 'subagent-running' })).toBeNull();
  });

  it('blocks when only a CI watcher still runs, and names the watcher', () => {
    const result = runHook({ transcript: 'watcher-only' });

    expect(result?.decision).toBe('block');
    expect(result?.reason).toContain('B1 (Offene Arbeit)');
    expect(result?.reason).toContain('still watching: Watch CI run 45579656348 until it ends');
  });

  it('stays silent in a session that is not the builder', () => {
    expect(runHook({ transcript: 'non-builder' })).toBeNull();
  });

  it('fires once per idle stop chain', () => {
    expect(runHook({ transcript: 'idle-all-done', stopHookActive: true })).toBeNull();
  });

  it('stays silent when every Builder row waits', () => {
    const queue = QUEUE.split('\n')
      .filter((line) => !line.startsWith('| B1 '))
      .join('\n');

    expect(runHook({ transcript: 'idle-all-done', queue })).toBeNull();
  });

  it('can be disabled per machine', () => {
    expect(runHook({ transcript: 'idle-all-done', localConfig: { disableHooks: ['builder-idle-check'] } })).toBeNull();
  });
});
