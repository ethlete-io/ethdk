import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { agentCommand, agentPrompt, assistedTasks, runAgentTasks } from './ai';
import { UpdateTask } from './tasks';

const spawnSync = vi.hoisted(() => vi.fn<(command: string) => { status: number }>());

vi.mock('child_process', async (importOriginal) => ({
  ...(await importOriginal<typeof import('child_process')>()),
  spawnSync,
}));

const task = (overrides: Partial<UpdateTask> = {}): UpdateTask => ({
  packageName: '@ethlete/core',
  name: 'a-change',
  version: '5.1.0',
  kind: 'assisted',
  description: 'Rewrite something',
  instructionsFile: '.ethlete/update/core-a-change.md',
  ...overrides,
});

describe('agentCommand', () => {
  it('hands the agent a prompt that names the task file, not only its path', () => {
    expect(agentCommand({ template: 'claude --permission-mode acceptEdits -p', taskPath: '/repo/task.md' })).toBe(
      `claude --permission-mode acceptEdits -p "${agentPrompt('/repo/task.md')}"`,
    );
    expect(agentPrompt('/repo/task.md')).toMatch(/^Apply the migration task described in \/repo\/task\.md /);
  });

  it('puts the prompt where the template asks for it', () => {
    expect(agentCommand({ template: 'agent --prompt <prompt> --yes', taskPath: '/repo/task.md' })).toBe(
      `agent --prompt "${agentPrompt('/repo/task.md')}" --yes`,
    );
  });

  it('puts only the path where the template asks for <file>', () => {
    expect(agentCommand({ template: 'claude -p "work <file> now"', taskPath: '/repo/task.md' })).toBe(
      'claude -p "work /repo/task.md now"',
    );
  });

  it('quotes a path that holds a space', () => {
    expect(agentCommand({ template: 'agent <file>', taskPath: '/my repo/task.md' })).toBe('agent "/my repo/task.md"');
  });
});

describe('runAgentTasks', () => {
  const makeRoot = () => {
    const root = mkdtempSync(join(tmpdir(), 'cli-ai-'));

    mkdirSync(join(root, '.ethlete', 'update'), { recursive: true });

    for (const name of ['first', 'second', 'third']) {
      writeFileSync(join(root, '.ethlete', 'update', `core-${name}.md`), 'Do it.', 'utf8');
    }

    return root;
  };

  const tasks = ['first', 'second', 'third'].map((name) =>
    task({ name, instructionsFile: join('.ethlete', 'update', `core-${name}.md`) }),
  );

  it('reports every task as it ends: done, left open, or failed', () => {
    const root = makeRoot();
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    spawnSync.mockImplementation((command: string) => {
      if (command.includes('core-first.md')) rmSync(join(root, '.ethlete', 'update', 'core-first.md'));

      return { status: command.includes('core-third.md') ? 2 : 0 };
    });

    const runs = runAgentTasks({ root, template: 'agent', tasks });

    expect(runs.map((run) => run.state)).toEqual(['done', 'open', 'failed']);
    expect(log).toHaveBeenCalledWith('\n  [1/3] @ethlete/core first: done');
    expect(error).toHaveBeenCalledWith(expect.stringContaining('[2/3] @ethlete/core second: the agent left'));
    expect(error).toHaveBeenCalledWith('\n  [3/3] @ethlete/core third: exited with 2');

    vi.restoreAllMocks();
  });
});

describe('assistedTasks', () => {
  it('takes only the assisted tasks that have a prompt', () => {
    const tasks = [
      task(),
      task({ name: 'manual-one', kind: 'manual' }),
      task({ name: 'no-prompt', instructionsFile: undefined }),
    ];

    expect(assistedTasks(tasks).map((entry) => entry.name)).toEqual(['a-change']);
  });
});
