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

  const run = (
    entries: object[],
    env: NodeJS.ProcessEnv = { ETHLETE_AGENT_ROLE: 'builder' },
    payload: Record<string, unknown> = {},
  ) => {
    const transcript = join(root, 'transcript.jsonl');
    writeFileSync(transcript, entries.map((entry) => JSON.stringify(entry)).join('\n'));

    return spawnSync('python3', [hookPath], {
      encoding: 'utf8',
      env: { ...process.env, ETHLETE_AGENT_ROLE: '', CLAUDE_PROJECT_DIR: root, ...env },
      input: JSON.stringify({ session_id: 's1', transcript_path: transcript, hook_event_name: 'Stop', ...payload }),
    });
  };

  const log = () =>
    readFileSync(join(root, '.claude/builder-chat-words.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));

  const block = {
    decision: 'block',
    reason:
      'builder: no chat text. Send the report with SendMessage to the grill session; end the turn with at most one line.',
  };

  it('logs the words of the current turn only', () => {
    const result = run([prompt, text('one two three'), prompt, text('a b'), toolResult, text('c d e')], undefined, {
      stop_hook_active: true,
    });

    expect(result.status).toBe(0);
    expect(log()).toMatchObject([{ session_id: 's1', words: 5, lines: 2 }]);
  });

  it('blocks a turn with a three-line chat reply once', () => {
    const result = run([prompt, text('Done.'), toolResult, text('The suite passed.\n\nNow I push.')]);

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(block);
    expect(log()).toMatchObject([{ lines: 3, blocked: true }]);
  });

  it('lets a one-line close through silently', () => {
    const result = run([prompt, text('three\nlines\nbefore'), prompt, toolResult, text('\nReport sent.\n')]);

    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
    expect(log()).toMatchObject([{ lines: 1, blocked: false }]);
  });

  it('blocks a three-line final message that is not in the transcript yet', () => {
    const result = run([prompt, toolResult], undefined, {
      last_assistant_message: 'The suite passed.\nI pushed.\nNext: 704.',
    });

    expect(JSON.parse(result.stdout)).toEqual(block);
    expect(log()).toMatchObject([{ lines: 3, blocked: true }]);
  });

  it('counts a final message once when the transcript already holds it', () => {
    const result = run([prompt, toolResult, text('Report sent.')], undefined, {
      last_assistant_message: 'Report sent.',
    });

    expect(result.stdout).toBe('');
    expect(log()).toMatchObject([{ lines: 1, blocked: false }]);
  });

  it('does not block again while stop_hook_active is set', () => {
    const result = run([prompt, text('one\ntwo\nthree')], undefined, { stop_hook_active: true });

    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
    expect(log()).toMatchObject([{ lines: 3, blocked: false }]);
  });

  it('does not block outside a builder session', () => {
    const result = run([prompt, text('one\ntwo\nthree')], { ETHLETE_AGENT_ROLE: '' });

    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
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
