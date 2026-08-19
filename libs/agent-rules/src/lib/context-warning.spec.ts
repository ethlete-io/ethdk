import { execFileSync } from 'child_process';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { randomUUID } from 'crypto';
import { describe, expect, it } from 'vitest';

type RunHookOptions = {
  model: string;
  tokens: number;
  window: number;
};

const hookPath = resolve(__dirname, '../../content/hooks/context-warning.py');

const runHook = (options: RunHookOptions) => {
  const { model, tokens, window } = options;
  const root = mkdtempSync(join(tmpdir(), 'agent-rules-context-warning-'));
  const transcriptPath = join(root, 'rollout.jsonl');
  const transcript = [
    { payload: { model } },
    { payload: { last_token_usage: { total_tokens: tokens }, model_context_window: window } },
  ];

  writeFileSync(transcriptPath, transcript.map((entry) => JSON.stringify(entry)).join('\n'), 'utf8');

  return execFileSync('python3', [hookPath, '--agent', 'codex'], {
    encoding: 'utf8',
    input: JSON.stringify({ cwd: root, session_id: randomUUID(), transcript_path: transcriptPath }),
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
});
