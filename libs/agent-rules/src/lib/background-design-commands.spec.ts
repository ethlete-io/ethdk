import { execFileSync } from 'child_process';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { describe, expect, it } from 'vitest';

const hookPath = resolve(__dirname, '../../content/hooks/background-design-commands.py');

type HookOutput = {
  hookSpecificOutput: { permissionDecision: string; permissionDecisionReason: string };
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
  ])('denies %s in the foreground and names the background form', (name, command) => {
    const result = runHook({ command });

    expect(result?.hookSpecificOutput.permissionDecision).toBe('deny');
    expect(result?.hookSpecificOutput.permissionDecisionReason).toContain(name);
    expect(result?.hookSpecificOutput.permissionDecisionReason).toContain('run_in_background: true');
  });

  it.each([
    'node dist/libs/cli/src/index.js design check',
    'node dist/libs/cli/src/index.js design sketch ready studio foo',
    'cd apps && node dist/libs/cli/src/index.js design compare studio',
    'npx nx studio:e2e ethlete-studio',
  ])('denies the %s form', (command) => {
    expect(decisionOf({ command })).toBe('deny');
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
  ])('still denies the command-position form %s', (command) => {
    expect(decisionOf({ command })).toBe('deny');
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
