import { execFileSync } from 'child_process';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { randomUUID } from 'crypto';
import { describe, expect, it } from 'vitest';

type RunHookOptions = {
  model: string;
  sessionId?: string;
  threadId?: string;
  threadSource?: 'subagent' | 'user';
  tokens: number;
  window: number;
};

const hookPath = resolve(__dirname, '../../content/hooks/context-warning.py');

const runHook = (options: RunHookOptions) => {
  const { model, sessionId = randomUUID(), threadId = randomUUID(), threadSource = 'user', tokens, window } = options;
  const root = mkdtempSync(join(tmpdir(), 'agent-rules-context-warning-'));
  const transcriptPath = join(root, 'rollout.jsonl');
  const transcript = [
    {
      type: 'session_meta',
      payload: {
        id: threadId,
        session_id: sessionId,
        thread_source: threadSource,
        ...(threadSource === 'subagent'
          ? { source: { subagent: { thread_spawn: { parent_thread_id: sessionId } } } }
          : { source: 'cli' }),
      },
    },
    { payload: { model } },
    { payload: { last_token_usage: { total_tokens: tokens }, model_context_window: window } },
  ];

  writeFileSync(transcriptPath, transcript.map((entry) => JSON.stringify(entry)).join('\n'), 'utf8');

  return execFileSync('python3', [hookPath, '--agent', 'codex'], {
    encoding: 'utf8',
    input: JSON.stringify({ cwd: root, session_id: sessionId, transcript_path: transcriptPath }),
  });
};

describe('context-warning Codex limits', () => {
  it.each(['gpt-5.6-sol', 'gpt-5.5', 'gpt-5.4'])('uses the 272k pricing boundary for %s', (model) => {
    const output = runHook({ model, tokens: 200_000, window: 1_050_000 });

    expect(output).toContain('272k long-context pricing boundary');
  });

  it('uses the reported window for GPT-5.4 mini', () => {
    const output = runHook({ model: 'gpt-5.4-mini', tokens: 200_000, window: 400_000 });

    expect(output).toBe('');
  });

  it('identifies sub-agent pressure without telling the main agent to hand off', () => {
    const output = runHook({
      model: 'gpt-5.6-sol',
      threadSource: 'subagent',
      tokens: 240_000,
      window: 1_050_000,
    });

    expect(output).toContain('This warning applies to a sub-agent thread, not the parent/main agent');
    expect(output).toContain('send the parent agent detailed findings');
    expect(output).toContain(
      "Do not create a user-facing session handoff or claim that the main agent's context is full",
    );
    expect(output).not.toContain('Tell the user:');
  });

  it('tracks warning tiers independently for root and sub-agent threads in one session', () => {
    const sessionId = randomUUID();
    const subagentOutput = runHook({
      model: 'gpt-5.6-sol',
      sessionId,
      threadId: randomUUID(),
      threadSource: 'subagent',
      tokens: 240_000,
      window: 1_050_000,
    });
    const rootOutput = runHook({
      model: 'gpt-5.6-sol',
      sessionId,
      threadId: randomUUID(),
      tokens: 240_000,
      window: 1_050_000,
    });

    expect(subagentOutput).not.toBe('');
    expect(rootOutput).toContain('Tell the user:');
  });
});
