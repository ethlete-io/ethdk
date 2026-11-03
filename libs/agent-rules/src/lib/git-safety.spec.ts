import { execFileSync } from 'child_process';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { describe, expect, it } from 'vitest';

const hookPath = resolve(__dirname, '../../content/hooks/git-safety.py');

type HookOutput = {
  hookSpecificOutput: { permissionDecision: string; permissionDecisionReason: string };
};

const runHook = (command: string, toolName = 'Bash') => {
  const root = mkdtempSync(join(tmpdir(), 'agent-rules-git-safety-'));

  const output = execFileSync('python3', [hookPath, '--agent', 'claude'], {
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: root },
    input: JSON.stringify({
      cwd: root,
      hook_event_name: 'PreToolUse',
      tool_name: toolName,
      tool_input: { command },
    }),
  });

  return output.trim() ? (JSON.parse(output) as HookOutput) : null;
};

const reasonOf = (command: string) => runHook(command)?.hookSpecificOutput.permissionDecisionReason ?? null;

describe('git-safety', () => {
  it.each([['git add -A'], ['git add --all'], ['git add .'], ['git -C apps add .'], ['yarn lint && git add -A']])(
    'denies %s and names the allowed form',
    (command) => {
      const result = runHook(command);

      expect(result?.hookSpecificOutput.permissionDecision).toBe('deny');
      expect(result?.hookSpecificOutput.permissionDecisionReason).toContain('git add <path>');
    },
  );

  it.each([
    ['git stash', 'git stash push'],
    ['git stash -u', 'git stash push'],
    ['git stash push -- a.ts', 'git stash push'],
    ['git stash save "wip"', 'git stash save'],
    ['git stash pop', 'git stash pop'],
    ['git stash apply stash@{0}', 'git stash apply'],
    ['git stash drop', 'git stash drop'],
    ['git stash clear', 'git stash clear'],
    ['git stash branch b', 'git stash branch'],
    ['git stash create', 'git stash create'],
    ['git stash store abc', 'git stash store'],
  ])('denies %s and names its subcommand', (command, named) => {
    expect(reasonOf(command)).toContain(named);
  });

  it.each(['git stash list', 'git stash show', 'git stash show -p stash@{1}', 'git -C apps stash list'])(
    'allows the read-only %s',
    (command) => {
      expect(runHook(command)).toBeNull();
    },
  );

  it('denies git commit --amend', () => {
    expect(reasonOf('git commit --amend -m "x" -- a.ts')).toContain('--amend');
  });

  it.each(['git commit -m "x"', 'git commit -am "x"', 'git commit'])('denies %s without a pathspec', (command) => {
    expect(reasonOf(command)).toContain('-- <paths>');
  });

  it.each([
    'git add .ethlete/design/studio/go.json',
    'git add .ethlete/design/studio-lab/go.json a.ts',
    'git commit -m "x" -- .ethlete/design/studio/go.json',
    'git commit -m "x" -- a.ts ".ethlete/design/studio/go.json"',
  ])('denies staging or committing a go.json: %s', (command) => {
    expect(reasonOf(command)).toContain('go.json');
  });

  it.each([
    'git add apps/a.ts libs/b.ts',
    'git commit -m "feat(x): Add a thing" -- apps/a.ts libs/b.ts',
    'git commit -m "x" -- apps/a.ts',
    'git status',
    'git diff --stat',
    'git commit-tree abc -p HEAD -m "merge"',
    'GIT_INDEX_FILE=/tmp/idx git update-index --add a.ts && GIT_INDEX_FILE=/tmp/idx git write-tree',
    'git stash list'.replace('stash list', 'log --oneline'),
  ])('allows %s', (command) => {
    expect(runHook(command)).toBeNull();
  });

  it('ignores quoted text such as a commit message', () => {
    expect(runHook('git commit -m "docs: never git stash or git add -A or amend" -- a.ts')).toBeNull();
    expect(runHook('git commit -m "$(cat <<\'EOF\'\nfix: git stash go.json\nEOF\n)" -- a.ts')).toBeNull();
  });

  it('ignores git mentioned as an argument', () => {
    expect(runHook('echo "git stash" && sed -i s/a/b/ "git add -A"')).toBeNull();
  });

  it('ignores tools other than Bash', () => {
    expect(runHook('git add -A', 'Write')).toBeNull();
  });
});
