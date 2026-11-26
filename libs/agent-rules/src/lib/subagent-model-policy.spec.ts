import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { describe, expect, it } from 'vitest';

const hookPath = resolve(__dirname, '../../content/hooks/subagent-model-policy.py');

type RunHookOptions = {
  toolName?: string;
  toolInput?: Record<string, unknown>;
  agentDefinition?: { name: string; contents: string };
  localConfig?: Record<string, unknown>;
  gitRepo?: boolean;
};

type HookOutput = {
  hookSpecificOutput: {
    permissionDecision: string;
    permissionDecisionReason: string;
    updatedInput?: Record<string, unknown>;
  };
};

const runHook = (options: RunHookOptions) => {
  const { toolName = 'Task', toolInput = {}, agentDefinition, localConfig, gitRepo } = options;
  const root = mkdtempSync(join(tmpdir(), 'agent-rules-subagent-model-'));

  if (gitRepo) {
    const gitEnv = { ...process.env, GIT_DIR: undefined, GIT_INDEX_FILE: undefined, GIT_WORK_TREE: undefined };
    execFileSync('git', ['init', '-q', '-b', 'main', root], { env: gitEnv });
    execFileSync(
      'git',
      ['-C', root, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'init'],
      {
        env: gitEnv,
      },
    );
  }

  if (agentDefinition) {
    mkdirSync(join(root, '.claude', 'agents'), { recursive: true });
    writeFileSync(join(root, '.claude', 'agents', `${agentDefinition.name}.md`), agentDefinition.contents, 'utf8');
  }

  if (localConfig) {
    writeFileSync(join(root, 'ethlete-agents.config.local.json'), JSON.stringify(localConfig), 'utf8');
  }

  const output = execFileSync('python3', [hookPath, '--agent', 'claude'], {
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: root },
    input: JSON.stringify({ cwd: root, hook_event_name: 'PreToolUse', tool_name: toolName, tool_input: toolInput }),
  });

  return { root, result: output.trim() ? (JSON.parse(output) as HookOutput) : null };
};

const startLog = (root: string) => join(root, '.git', 'ethlete', 'subagent-starts.jsonl');

const decisionOf = (options: RunHookOptions) => runHook(options).result?.hookSpecificOutput.permissionDecision ?? null;

describe('subagent-model-policy', () => {
  it('runs a call that names no model on sonnet, and returns the model table', () => {
    const toolInput = { subagent_type: 'general-purpose', prompt: 'Find the overlay tests' };
    const { result } = runHook({ toolInput });

    expect(result?.hookSpecificOutput.permissionDecision).toBe('allow');
    expect(result?.hookSpecificOutput.updatedInput).toEqual({ ...toolInput, model: 'sonnet' });
    expect(result?.hookSpecificOutput.permissionDecisionReason).toContain('`haiku`');
    expect(result?.hookSpecificOutput.permissionDecisionReason).toContain('`opus`');
  });

  it('asks the user before a subagent runs on fable, and leaves its input alone', () => {
    const { result } = runHook({ toolInput: { model: 'fable', prompt: 'Review the plan' } });

    expect(result?.hookSpecificOutput.permissionDecision).toBe('ask');
    expect(result?.hookSpecificOutput.updatedInput).toBeUndefined();
  });

  it.each(['opus', 'sonnet', 'haiku'])('allows an explicit %s', (model) => {
    expect(decisionOf({ toolInput: { model } })).toBeNull();
  });

  it('leaves a fork alone, because it inherits the parent model either way', () => {
    expect(decisionOf({ toolInput: { subagent_type: 'fork' } })).toBeNull();
  });

  it('leaves an agent type whose own definition sets a model alone', () => {
    const agentDefinition = { name: 'reviewer', contents: '---\nname: reviewer\nmodel: opus\n---\n' };

    expect(decisionOf({ toolInput: { subagent_type: 'reviewer' }, agentDefinition })).toBeNull();
  });

  it('finds a definition whose file name is capitalized, as a built-in override like Explore.md is', () => {
    const agentDefinition = { name: 'Explore', contents: '---\nname: Explore\nmodel: haiku\n---\n' };

    expect(decisionOf({ toolInput: { subagent_type: 'Explore' }, agentDefinition })).toBeNull();
  });

  it('defaults an agent definition that declares no model to sonnet', () => {
    const agentDefinition = { name: 'reviewer', contents: '---\nname: reviewer\n---\n' };
    const { result } = runHook({ toolInput: { subagent_type: 'reviewer' }, agentDefinition });

    expect(result?.hookSpecificOutput.updatedInput?.['model']).toBe('sonnet');
  });

  it('ignores every tool but the one that spawns a subagent', () => {
    expect(decisionOf({ toolName: 'Bash', toolInput: {} })).toBeNull();
  });

  it('stays silent when the local config disables it', () => {
    expect(decisionOf({ toolInput: {}, localConfig: { disableHooks: ['subagent-model-policy'] } })).toBeNull();
    expect(decisionOf({ toolInput: {}, localConfig: { disableHooks: true } })).toBeNull();
  });

  it('logs each start with its model, effort, HEAD and the files its prompt names', () => {
    const prompt = 'Fix libs/core/src/a.ts:10-20 and its spec libs/core/src/a.spec.ts, see https://x.dev/b/c.html';
    const { root } = runHook({ gitRepo: true, toolInput: { description: 'Fix a', effort: 'low', prompt } });
    const [entry] = readFileSync(startLog(root), 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    const head = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

    expect(entry).toMatchObject({
      model: 'sonnet',
      decision: 'allow',
      effort: 'low',
      description: 'Fix a',
      head,
      branch: 'main',
      files: ['libs/core/src/a.ts', 'libs/core/src/a.spec.ts'],
    });
  });

  it('logs a start it leaves untouched too, with the model the call names', () => {
    const { root } = runHook({ gitRepo: true, toolInput: { model: 'opus', prompt: 'Review' } });
    const entry = JSON.parse(readFileSync(startLog(root), 'utf8'));

    expect(entry).toMatchObject({ model: 'opus', decision: 'untouched', files: [] });
  });

  it('logs nothing outside a git repo and still decides', () => {
    const { root, result } = runHook({ toolInput: {} });

    expect(result?.hookSpecificOutput.permissionDecision).toBe('allow');
    expect(existsSync(join(root, '.git'))).toBe(false);
  });
});
