import { spawnSync } from 'child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { agentCommand, agentEnv, agentPrompt, assistedTasks, finishedPath, runAgentTasks } from './ai';
import { UpdateTask } from './tasks';

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
    expect(agentPrompt('/repo/task.md')).toContain('create the empty file /repo/task.finished');
  });

  it('puts the prompt where the template asks for it', () => {
    expect(agentCommand({ template: 'agent --prompt <prompt> --yes', platform: 'linux' })).toBe(
      'agent --prompt "$ETHLETE_UPDATE_PROMPT" --yes',
    );
  });

  it('uses cmd variable syntax on Windows', () => {
    expect(agentCommand({ template: 'agent <file>', platform: 'win32' })).toBe('agent "%ETHLETE_UPDATE_TASK_FILE%"');
  });

  it.runIf(process.platform !== 'win32')('passes a task path with shell characters to the command unchanged', () => {
    const taskPath = `/my repo/$HOME/\`id\`/"it's" (a)&b/task.md`;

    for (const template of ['printf %s <file>', 'printf %s "in <file> now"']) {
      const result = spawnSync(agentCommand({ template }), {
        shell: true,
        encoding: 'utf8',
        env: { ...process.env, ...agentEnv(taskPath) },
      });

      expect(result.stdout).toBe(template.includes('in ') ? `in ${taskPath} now` : taskPath);
    }
  });
});

describe('runAgentTasks', () => {
  const FAKE_AGENT = `
    const fs = require('fs');
    const task = process.env.ETHLETE_UPDATE_TASK_FILE;
    const [mode] = fs.readFileSync(task, 'utf8').split('\\n');

    fs.appendFileSync(process.argv[2], task.slice(-8) + '\\n');

    if (mode === 'done') fs.rmSync(task);
    if (mode === 'fail') process.exit(2);
    if (mode.startsWith('finish')) {
      fs.rmSync(task);
      fs.writeFileSync(process.env.ETHLETE_UPDATE_FINISHED_FILE, '');
      if (mode === 'finish-stubborn') process.on('SIGTERM', () => undefined);
      setTimeout(() => undefined, 60_000);
    }
  `;

  const makeRoot = (modes: Record<string, string>) => {
    const root = mkdtempSync(join(tmpdir(), 'cli-ai-'));

    mkdirSync(join(root, '.ethlete', 'update'), { recursive: true });
    writeFileSync(join(root, 'agent.js'), FAKE_AGENT, 'utf8');

    for (const [name, mode] of Object.entries(modes)) {
      writeFileSync(join(root, '.ethlete', 'update', `core-${name}.md`), `${mode}\n`, 'utf8');
    }

    return {
      root,
      template: `node agent.js runs.log; true`,
      started: () => readFileSync(join(root, 'runs.log'), 'utf8').trim().split('\n'),
      tasks: Object.keys(modes).map((name) =>
        task({ name, instructionsFile: join('.ethlete', 'update', `core-${name}.md`) }),
      ),
    };
  };

  const quiet = () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    return vi.spyOn(console, 'error').mockImplementation(() => undefined);
  };

  it('reports every task as it ends: done, left open, or failed', async () => {
    const { root, template, tasks } = makeRoot({ first: 'done', second: 'open', third: 'fail' });
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const runs = await runAgentTasks({ root, template: 'node agent.js runs.log', tasks });

    expect(template).toContain('agent.js');
    expect(runs.map((run) => run.state)).toEqual(['done', 'open', 'failed']);
    expect(log).toHaveBeenCalledWith('\n  [1/3] @ethlete/core first: done');
    expect(error).toHaveBeenCalledWith(expect.stringContaining('[2/3] @ethlete/core second: the agent left'));
    expect(error).toHaveBeenCalledWith('\n  [3/3] @ethlete/core third: exited with 2');

    vi.restoreAllMocks();
  });

  it('settles each task before the next starts, and names the ones that are not committed', async () => {
    const { root, template, tasks, started } = makeRoot({ first: 'done', second: 'open', third: 'done' });
    const order: string[] = [];
    const error = quiet();

    await runAgentTasks({
      root,
      template,
      tasks,
      afterRun: (run) => order.push(`${run.state} ${run.task.name} after ${started().length} run(s)`),
    });

    expect(order).toEqual(['done first after 1 run(s)', 'open second after 2 run(s)', 'done third after 3 run(s)']);
    expect(error).toHaveBeenCalledWith(expect.stringMatching(/second: the agent left .*, so it is not committed$/));

    vi.restoreAllMocks();
  });

  it.runIf(process.platform !== 'win32')(
    'ends a session that wrote the finished file and moves on to the next task',
    async () => {
      const { root, template, tasks, started } = makeRoot({
        first: 'finish',
        second: 'finish-stubborn',
        third: 'open',
      });

      quiet();

      const runs = await runAgentTasks({ root, template, tasks, timing: { pollMs: 20, settleMs: 50, killMs: 300 } });

      expect(runs.map((run) => run.state)).toEqual(['done', 'done', 'open']);
      expect(started()).toEqual(['first.md', 'econd.md', 'third.md']);
      expect(existsSync(finishedPath(join(root, tasks[0]?.instructionsFile ?? '')))).toBe(false);

      vi.restoreAllMocks();
    },
    10_000,
  );
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
