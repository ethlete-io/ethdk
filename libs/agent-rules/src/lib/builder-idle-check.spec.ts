import { execFileSync } from 'child_process';
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
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
  consumerPlan?: boolean;
};

const runHook = (options: RunOptions) => {
  const { transcript, stopHookActive = false, queue = QUEUE, localConfig, consumerPlan = false } = options;
  const parent = mkdtempSync(join(tmpdir(), 'agent-rules-builder-idle-'));
  const root = join(parent, 'repo');

  mkdirSync(join(root, 'plans'), { recursive: true });
  writeFileSync(join(root, 'plans', 'QUEUE.md'), queue, 'utf8');

  if (consumerPlan) {
    mkdirSync(join(parent, 'specs', 'tracks', 'track'), { recursive: true });
    copyFileSync(
      resolve(__dirname, 'fixtures/builder-idle-check/plans/checkbox-plan.md'),
      join(parent, 'specs', 'tracks', 'track', 'plan.md'),
    );
  }

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
    expect(runHook({ transcript: 'subagent-running', localConfig: { builderSlots: 1 } })).toBeNull();
  });

  it('stays silent while a subagent is waiting on its own background work', () => {
    expect(runHook({ transcript: 'subagent-waiting-on-background', localConfig: { builderSlots: 1 } })).toBeNull();
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

  it('blocks while fewer agents run than the slot limit and a Builder row is free', () => {
    const result = runHook({ transcript: 'two-agents-running', localConfig: { builderSlots: 4 } });

    expect(result?.decision).toBe('block');
    expect(result?.reason).toContain('B1 (Offene Arbeit)');
    expect(result?.reason).toContain('2 of 4');
  });

  it('counts agents from before a /clear that are unfinished in the session subagents dir', () => {
    const result = runHook({ transcript: 'cleared-session' });

    expect(result?.reason).toContain('3 of 4');
    expect(result?.reason).toContain('B832 sample-aware matching');
    expect(result?.reason).not.toContain('B700');
    expect(runHook({ transcript: 'cleared-session', localConfig: { builderSlots: 3 } })).toBeNull();
  });

  it('stays silent once the running agents fill the slot limit', () => {
    expect(runHook({ transcript: 'two-agents-running', localConfig: { builderSlots: 2 } })).toBeNull();
  });

  it('uses 4 slots without a config', () => {
    expect(runHook({ transcript: 'two-agents-running' })?.reason).toContain('2 of 4');
    expect(runHook({ transcript: 'two-agents-running', localConfig: { builderSlots: 'many' } })?.reason).toContain(
      '2 of 4',
    );
  });

  it('stays silent with a free slot when no Builder row is free', () => {
    const queue = QUEUE.split('\n')
      .filter((line) => !line.startsWith('| B1 '))
      .join('\n');

    expect(runHook({ transcript: 'two-agents-running', queue })).toBeNull();
  });

  describe('in a consumer repo', () => {
    const consumerConfig = {
      builderIdle: {
        queues: [{ path: '../specs/tracks/track/plan.md', format: 'checkbox' }],
        waitPatterns: ['blockiert durch', 'wartet auf'],
      },
    };

    it('blocks a coordinator session at 0 of 4 agents while a checkbox plan has open rows', () => {
      const result = runHook({ transcript: 'coordinator-idle', consumerPlan: true, localConfig: consumerConfig });

      expect(result?.decision).toBe('block');
      expect(result?.reason).toContain('0 of 4');
      expect(result?.reason).toContain('../specs/tracks/track/plan.md');
      expect(result?.reason).toContain('9.7 (Restliste');
      expect(result?.reason).not.toContain('7.13');
      expect(result?.reason).not.toContain('7.14');
      expect(result?.reason).not.toContain('8.1');
      expect(result?.reason).toContain('"blockiert durch" or "wartet auf"');
    });

    it('does not count a coordinator without the role configured away', () => {
      const localConfig = { builderIdle: { ...consumerConfig.builderIdle, roles: ['builder'] } };

      expect(runHook({ transcript: 'coordinator-idle', consumerPlan: true, localConfig })).toBeNull();
    });

    it('treats a row as open when it holds no configured wait pattern', () => {
      const localConfig = { builderIdle: { ...consumerConfig.builderIdle, waitPatterns: ['nichts'] } };
      const result = runHook({ transcript: 'coordinator-idle', consumerPlan: true, localConfig });

      expect(result?.reason).toContain('7.14');
      expect(result?.reason).toContain('8.1');
    });

    it('stays silent while enough agents run', () => {
      const localConfig = { ...consumerConfig, builderSlots: 1 };

      expect(runHook({ transcript: 'subagent-running', consumerPlan: true, localConfig })).toBeNull();
    });
  });
});
