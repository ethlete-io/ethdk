import { spawnSync } from 'child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const hookPath = resolve(__dirname, '../../content/hooks/builder-chat-words.py');

describe('builder-chat-words', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'agent-rules-builder-words-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  const text = (words: string) => ({ type: 'assistant', message: { content: [{ type: 'text', text: words }] } });
  const prompt = { type: 'user', message: { content: 'go' } };
  const toolResult = { type: 'user', message: { content: [{ type: 'tool_result', content: 'ok' }] } };

  const run = (entries: object[], env: NodeJS.ProcessEnv = { ETHLETE_AGENT_ROLE: 'builder' }) => {
    const transcript = join(root, 'transcript.jsonl');
    writeFileSync(transcript, entries.map((entry) => JSON.stringify(entry)).join('\n'));

    return spawnSync('python3', [hookPath], {
      encoding: 'utf8',
      env: { ...process.env, ETHLETE_AGENT_ROLE: '', CLAUDE_PROJECT_DIR: root, ...env },
      input: JSON.stringify({ session_id: 's1', transcript_path: transcript, hook_event_name: 'Stop' }),
    });
  };

  const log = () =>
    readFileSync(join(root, '.claude/builder-chat-words.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));

  it('logs the words of the current turn only, silently', () => {
    const result = run([prompt, text('one two three'), prompt, text('a b'), toolResult, text('c d e')]);

    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
    expect(log()).toMatchObject([{ session_id: 's1', words: 5 }]);
  });

  it('writes nothing outside a builder session', () => {
    const result = run([prompt, text('one two')], { ETHLETE_AGENT_ROLE: '' });

    expect(result.status).toBe(0);
    expect(existsSync(join(root, '.claude/builder-chat-words.jsonl'))).toBe(false);
  });

  it('exits 0 on a missing transcript or bad input', () => {
    const result = spawnSync('python3', [hookPath], {
      encoding: 'utf8',
      env: { ...process.env, ETHLETE_AGENT_ROLE: 'builder', CLAUDE_PROJECT_DIR: root },
      input: 'not json',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });
});
