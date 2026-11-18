import { execFileSync } from 'child_process';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { describe, expect, it } from 'vitest';

const hookPath = resolve(__dirname, '../../content/hooks/background-design-commands.py');

type HookOutput = {
  hookSpecificOutput: {
    permissionDecision: string;
    permissionDecisionReason: string;
    updatedInput?: Record<string, unknown>;
  };
};

const runHook = (options: {
  command: string;
  background?: boolean;
  toolName?: string;
  localConfig?: Record<string, unknown>;
}) => {
  const { command, background, toolName = 'Bash', localConfig } = options;
  const root = mkdtempSync(join(tmpdir(), 'agent-rules-background-design-'));

  if (localConfig) {
    writeFileSync(join(root, 'ethlete-agents.config.local.json'), JSON.stringify(localConfig), 'utf8');
  }

  const output = execFileSync('python3', [hookPath, '--agent', 'claude'], {
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: root },
    input: JSON.stringify({
      cwd: root,
      hook_event_name: 'PreToolUse',
      tool_name: toolName,
      tool_input: { command, ...(background === undefined ? {} : { run_in_background: background }) },
    }),
  });

  return output.trim() ? (JSON.parse(output) as HookOutput) : null;
};

const decisionOf = (options: Parameters<typeof runHook>[0]) =>
  runHook(options)?.hookSpecificOutput.permissionDecision ?? null;

describe('background-design-commands', () => {
  it.each([
    ['design check', 'yarn design check --part x'],
    ['design compare', 'yarn design compare studio'],
    ['design ready', 'yarn design ready studio'],
    ['design sketch ready', 'yarn design sketch ready studio components-card'],
    ['design harness', 'yarn design harness studio'],
    ['studio:e2e', 'npx nx run ethlete-studio:studio:e2e'],
  ])('moves %s from the foreground into the background', (name, command) => {
    const result = runHook({ command });

    expect(result?.hookSpecificOutput.permissionDecision).toBe('allow');
    expect(result?.hookSpecificOutput.updatedInput?.['run_in_background']).toBe(true);
    expect(result?.hookSpecificOutput.updatedInput?.['command']).toBe(command);
    expect(result?.hookSpecificOutput.permissionDecisionReason).toContain(name);
    expect(result?.hookSpecificOutput.permissionDecisionReason).toContain('run_in_background: true');
  });

  it.each([
    'node dist/libs/cli/src/index.js design check',
    'node dist/libs/cli/src/index.js design sketch ready studio foo',
    'cd apps && node dist/libs/cli/src/index.js design compare studio',
    'npx nx studio:e2e ethlete-studio',
  ])('moves the %s form into the background', (command) => {
    expect(decisionOf({ command })).toBe('allow');
  });

  it.each([
    'yarn design check',
    'yarn design compare studio',
    'yarn design ready studio',
    'yarn design sketch ready studio x',
    'yarn design harness studio',
    'npx nx run ethlete-studio:studio:e2e',
  ])('allows %s with run_in_background', (command) => {
    expect(decisionOf({ command, background: true })).toBeNull();
  });

  it.each([
    'yarn design compare --help',
    'node dist/libs/cli/src/index.js design check -h',
    'yarn design --help',
    'yarn design shot studio x',
    'yarn design sketch start studio x',
    'yarn lint',
  ])('allows the short command %s', (command) => {
    expect(decisionOf({ command })).toBeNull();
  });

  it('ignores quoted text such as a commit message', () => {
    expect(decisionOf({ command: 'git commit -m "docs: run design check in background"' })).toBeNull();
  });

  it.each([
    ['a commit message', 'git commit -m "fix(repo): design check no longer blocks" -- a.ts'],
    ['an echo string', 'echo "run design ready later"'],
    ['an unquoted echo', 'echo design ready'],
    ['a heredoc commit message', "git commit -F - <<'EOF'\nfix: design ready hook\n\nyarn design check studio\nEOF"],
    ['a substituted heredoc', 'git commit -m "$(cat <<\'EOF\'\ndesign check in the foreground\nEOF\n)"'],
    ['a grep pattern', "grep -rn 'design compare' plans"],
    ['an unquoted grep', 'grep -rn design check plans'],
    ['a cat and an echo', 'cat notes.txt && echo design harness'],
  ])('ignores %s that only names a long command', (_name, command) => {
    expect(decisionOf({ command })).toBeNull();
  });

  it.each([
    'FOO=1 yarn design check',
    'echo start && yarn design ready studio',
    'git status; node dist/libs/cli/src/index.js design compare studio',
    'echo $(yarn design check)',
    'cat <<EOF\nhello\nEOF\nyarn design harness studio',
    'timeout 600 yarn design check',
    'yarn studio:e2e --help',
  ])('still moves the command-position form %s', (command) => {
    expect(decisionOf({ command })).toBe('allow');
  });

  it.each([
    ['an until loop', 'until grep -q "Ready in" dev.log; do sleep 0.5; done'],
    [
      'a multi-line until loop',
      'until [ "$(gh run view 1 --json status -q .status)" = "completed" ]\ndo\n  sleep 60\ndone; echo ok',
    ],
    ['a while loop', 'while ! curl -sf localhost:4400 >/dev/null; do sleep 1; done'],
    ['a while true loop', 'cd /repo && while true; do gh run list --limit 1; /usr/bin/sleep 30; done'],
  ])('moves %s that sleeps into the background', (_name, command) => {
    const result = runHook({ command });

    expect(result?.hookSpecificOutput.permissionDecision).toBe('allow');
    expect(result?.hookSpecificOutput.updatedInput?.['run_in_background']).toBe(true);
    expect(result?.hookSpecificOutput.updatedInput?.['command']).toBe(command);
    expect(result?.hookSpecificOutput.permissionDecisionReason).toContain('completion notice');
  });

  it.each([
    ['a loop already in the background', { command: 'until test -f x; do sleep 1; done', background: true }],
    ['a loop without sleep', { command: 'while read -r line; do echo "$line"; done < file.txt' }],
    ['a for loop that sleeps', { command: 'for i in 1 2 3; do curl -s localhost; sleep 1; done' }],
    ['a sleep after a finished loop', { command: 'while read -r l; do echo "$l"; done < f; sleep 1' }],
    ['a loop inside quoted text', { command: 'git commit -m "until x; do sleep 1; done"' }],
    ['a plain sleep', { command: 'sleep 2 && echo done' }],
  ])('leaves %s alone', (_name, options) => {
    expect(decisionOf(options)).toBeNull();
  });

  it('ignores tools other than Bash', () => {
    expect(decisionOf({ command: 'yarn design check', toolName: 'Write' })).toBeNull();
  });

  it('can be disabled per machine', () => {
    expect(
      decisionOf({ command: 'yarn design check', localConfig: { disableHooks: ['background-design-commands'] } }),
    ).toBeNull();
  });
});
