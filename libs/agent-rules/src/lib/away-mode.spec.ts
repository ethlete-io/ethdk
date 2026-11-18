import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { describe, expect, it } from 'vitest';

const hookPath = resolve(__dirname, '../../content/hooks/away-mode.py');
const gitEnv = { ...process.env, GIT_DIR: undefined, GIT_INDEX_FILE: undefined, GIT_WORK_TREE: undefined };
const SESSION = 'session-1';
const SUFFIX = ' [typed by agent-sessions]';
const config = { awayMode: { skills: ['doc-agent'], thresholdMinutes: 15 } };

type State = { active: boolean; lastHumanInput: string | null; away: boolean };

const setup = (options: { config?: Record<string, unknown>; localConfig?: Record<string, unknown>; git?: boolean }) => {
  const { git = true } = options;
  const root = mkdtempSync(join(tmpdir(), 'agent-rules-away-mode-'));

  if (git) execFileSync('git', ['init', '-q', '-b', 'main', root], { env: gitEnv });
  if (options.config) writeFileSync(join(root, 'ethlete-agents.config.json'), JSON.stringify(options.config), 'utf8');
  if (options.localConfig) {
    writeFileSync(join(root, 'ethlete-agents.config.local.json'), JSON.stringify(options.localConfig), 'utf8');
  }

  const statePath = join(root, '.git', 'ethlete', 'away', `${SESSION}.json`);

  return {
    root,
    statePath,
    state: () => (existsSync(statePath) ? (JSON.parse(readFileSync(statePath, 'utf8')) as State) : null),
    writeState: (state: State) => {
      mkdirSync(join(root, '.git', 'ethlete', 'away'), { recursive: true });
      writeFileSync(statePath, JSON.stringify(state), 'utf8');
    },
    send: (prompt: string) => {
      const output = execFileSync('python3', [hookPath, '--agent', 'claude'], {
        encoding: 'utf8',
        env: { ...process.env, CLAUDE_PROJECT_DIR: root },
        input: JSON.stringify({
          cwd: root,
          hook_event_name: 'UserPromptSubmit',
          session_id: SESSION,
          prompt,
        }),
      });

      if (!output.trim()) return null;

      const parsed = JSON.parse(output) as { hookSpecificOutput: { additionalContext: string } };

      return parsed.hookSpecificOutput.additionalContext;
    },
  };
};

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const MAILBOX = 'Mailbox message from builder: question';

describe('away-mode', () => {
  it('does nothing without config', () => {
    const session = setup({});

    expect(session.send('/doc-agent')).toBeNull();
    expect(session.state()).toBeNull();
  });

  it('activates on a prompt that invokes a configured skill', () => {
    const session = setup({ config });

    expect(session.send('hello')).toBeNull();
    expect(session.state()).toBeNull();
    expect(session.send('/doc-agent')).toBeNull();
    expect(session.state()).toMatchObject({ active: true, away: false });
    expect(session.state()?.lastHumanInput).toBeTruthy();
  });

  it('activates on a restart prompt without counting it as typed input', () => {
    const session = setup({ config });

    session.send(`/handoff resume doc-agent-2026-11-18${SUFFIX}`);

    expect(session.state()).toMatchObject({ active: true, away: false, lastHumanInput: null });
  });

  it('stays quiet for a mailbox prompt before the threshold', () => {
    const session = setup({ config });
    session.writeState({ active: true, lastHumanInput: minutesAgo(5), away: false });

    expect(session.send(MAILBOX)).toBeNull();
    expect(session.state()?.away).toBe(false);
  });

  it('goes away on a mailbox prompt after the threshold, then reminds once per prompt', () => {
    const session = setup({ config });
    session.writeState({ active: true, lastHumanInput: minutesAgo(20), away: false });

    expect(session.send(MAILBOX)).toContain('The user is away (no typed input for 20 min)');
    expect(session.state()?.away).toBe(true);
    expect(session.send('<task-notification>done</task-notification>')).toContain('The user is still away');
  });

  it('tells the agent the user is back on typed input', () => {
    const session = setup({ config });
    session.writeState({ active: true, lastHumanInput: minutesAgo(30), away: true });

    expect(session.send('ok, here')).toContain('The user is back (typed input after 30 min away)');
    expect(session.state()).toMatchObject({ away: false });
    expect(session.send('next')).toBeNull();
  });

  it('does not refresh the timestamp on a prompt typed by agent-sessions', () => {
    const session = setup({ config });
    const last = minutesAgo(20);
    session.writeState({ active: true, lastHumanInput: last, away: false });

    session.send(`/handoff resume doc-agent-x${SUFFIX}`);

    expect(session.state()?.lastHumanInput).toBe(last);
  });

  it('marks the session away at once on afk, and back on the next typed input', () => {
    const session = setup({ config });
    session.writeState({ active: true, lastHumanInput: minutesAgo(1), away: false });

    expect(session.send('  AFK ')).toBeNull();
    expect(session.state()?.away).toBe(true);
    expect(session.send('back')).toContain('The user is back');
  });

  it('does nothing when the hook is disabled locally', () => {
    const session = setup({ config, localConfig: { disableHooks: ['away-mode'] } });

    expect(session.send('/doc-agent')).toBeNull();
    expect(session.state()).toBeNull();
  });

  it('lets the local config override the shared one', () => {
    const session = setup({ config, localConfig: { awayMode: { skills: ['other'], thresholdMinutes: 1 } } });

    expect(session.send('/doc-agent')).toBeNull();
    expect(session.state()).toBeNull();
    session.send('/other');
    expect(session.state()?.active).toBe(true);
  });

  it('does nothing outside a git repo', () => {
    const session = setup({ config, git: false });

    expect(session.send('/doc-agent')).toBeNull();
    expect(existsSync(join(session.root, '.git'))).toBe(false);
  });
});
