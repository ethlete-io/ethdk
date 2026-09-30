import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { agentCommand, agentEnv, agentPrompt, assistedTasks, runAgentTasks } from './ai';
import { UpdateTask } from './tasks';

const spawnSync = vi.hoisted(() =>
  vi.fn<(command: string, options?: { env?: Record<string, string> }) => { status: number }>(),
);

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
  it('appends the prompt as a quoted variable when the template has no placeholder', () => {
    expect(agentCommand({ template: 'claude --permission-mode acceptEdits -p', platform: 'linux' })).toBe(
      'claude --permission-mode acceptEdits -p "$ETHLETE_UPDATE_PROMPT"',
    );
    expect(agentPrompt('/repo/task.md')).toMatch(/^Apply the migration task described in \/repo\/task\.md /);
    expect(agentPrompt('/repo/task.md')).toContain('Do not commit');
  });

  it('puts the prompt where the template asks for it', () => {
    expect(agentCommand({ template: 'agent --prompt <prompt> --yes', platform: 'linux' })).toBe(
      'agent --prompt "$ETHLETE_UPDATE_PROMPT" --yes',
    );
  });

  it('uses cmd variable syntax on Windows', () => {
    expect(agentCommand({ template: 'agent <file>', platform: 'win32' })).toBe('agent "%ETHLETE_UPDATE_TASK_FILE%"');
  });

  it.runIf(process.platform !== 'win32')(
    'passes a task path with shell characters to the command unchanged',
    async () => {
      const actual = await vi.importActual<typeof import('child_process')>('child_process');
      const taskPath = `/my repo/$HOME/\`id\`/"it's" (a)&b/task.md`;

      for (const template of ['printf %s <file>', 'printf %s "in <file> now"']) {
        const result = actual.spawnSync(agentCommand({ template }), {
          shell: true,
          encoding: 'utf8',
          env: { ...process.env, ...agentEnv(taskPath) },
        });

        expect(result.stdout).toBe(template.includes('in ') ? `in ${taskPath} now` : taskPath);
      }
    },
  );
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

    spawnSync.mockImplementation((_command: string, options?: { env?: Record<string, string> }) => {
      const taskFile = options?.env?.['ETHLETE_UPDATE_TASK_FILE'] ?? '';

      if (taskFile.endsWith('core-first.md')) rmSync(taskFile);

      return { status: taskFile.endsWith('core-third.md') ? 2 : 0 };
    });

    const runs = runAgentTasks({ root, template: 'agent', tasks });

    expect(runs.map((run) => run.state)).toEqual(['done', 'open', 'failed']);
    expect(log).toHaveBeenCalledWith('\n  [1/3] @ethlete/core first: done');
    expect(error).toHaveBeenCalledWith(expect.stringContaining('[2/3] @ethlete/core second: the agent left'));
    expect(error).toHaveBeenCalledWith('\n  [3/3] @ethlete/core third: exited with 2');

    vi.restoreAllMocks();
  });

  it('settles each task before the next starts, and names the ones that are not committed', () => {
    const root = makeRoot();
    const order: string[] = [];

    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    spawnSync.mockImplementation((_command: string, options?: { env?: Record<string, string> }) => {
      const taskFile = options?.env?.['ETHLETE_UPDATE_TASK_FILE'] ?? '';

      order.push(`run ${taskFile.slice(-8)}`);

      if (!taskFile.endsWith('core-second.md')) rmSync(taskFile);

      return { status: 0 };
    });

    runAgentTasks({ root, template: 'agent', tasks, afterRun: (run) => order.push(`${run.state} ${run.task.name}`) });

    expect(order).toEqual(['run first.md', 'done first', 'run econd.md', 'open second', 'run third.md', 'done third']);
    expect(error).toHaveBeenCalledWith(expect.stringMatching(/second: the agent left .*, so it is not committed$/));

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
