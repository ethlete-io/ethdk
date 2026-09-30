import { spawn, spawnSync } from 'child_process';
import { existsSync, rmSync } from 'fs';
import { join } from 'path';
import { setTimeout as delay } from 'timers/promises';
import { UpdateTask } from './tasks';

/** Where the agent command sits in `ethlete.config.local.json`. */
export const AGENT_COMMAND_KEY = 'updateAgentCommand';

/** An interactive agent command that can edit files without asking, for the error that names the key. */
export const AGENT_COMMAND_EXAMPLE = 'claude --permission-mode auto';

/** Where the command template takes the whole prompt. */
export const PROMPT_PLACEHOLDER = '<prompt>';

/** Where the command template takes only the path of the task file. */
export const FILE_PLACEHOLDER = '<file>';

/** The file an agent writes to tell `et update` that it is finished with a task. */
export const finishedPath = (taskPath: string) => `${taskPath.replace(/\.md$/, '')}.finished`;

/** The prompt one assisted task is handed to an agent with. */
export const agentPrompt = (taskPath: string) =>
  `Apply the migration task described in ${taskPath} to this repository. ` +
  'Follow its instructions, then delete that file once the change is complete. ' +
  'Do not commit: et update commits your change. ' +
  `When you are finished and the user has no more questions for you, create the empty file ${finishedPath(taskPath)} ` +
  'as your very last step: et update then ends this session, commits the change and starts the next task.';

export const PROMPT_ENV = 'ETHLETE_UPDATE_PROMPT';
export const FILE_ENV = 'ETHLETE_UPDATE_TASK_FILE';
export const FINISHED_ENV = 'ETHLETE_UPDATE_FINISHED_FILE';

const reference = (options: { name: string; platform: NodeJS.Platform; insideQuotes: boolean }) => {
  const { name, platform, insideQuotes } = options;
  const bare = platform === 'win32' ? `%${name}%` : `$${name}`;

  return insideQuotes ? bare : `"${bare}"`;
};

const PLACEHOLDERS = [
  { text: PROMPT_PLACEHOLDER, name: PROMPT_ENV },
  { text: FILE_PLACEHOLDER, name: FILE_ENV },
];

/**
 * The command that hands one task to an agent. `<prompt>` becomes the prompt, `<file>` the path of the
 * task file; a template with neither gets the prompt appended, which is what `claude -p` needs. Both
 * values reach the shell as variable references; run it with `agentEnv`.
 */
export const agentCommand = (options: { template: string; platform?: NodeJS.Platform }) => {
  const { template, platform = process.platform } = options;

  if (!PLACEHOLDERS.some(({ text }) => template.includes(text))) {
    return `${template} ${reference({ name: PROMPT_ENV, platform, insideQuotes: false })}`;
  }

  let command = '';
  let insideQuotes = false;

  for (let index = 0; index < template.length;) {
    const placeholder = PLACEHOLDERS.find(({ text }) => template.startsWith(text, index));

    if (placeholder) {
      command += reference({ name: placeholder.name, platform, insideQuotes });
      index += placeholder.text.length;
      continue;
    }

    const char = template.charAt(index);

    if (char === '"') insideQuotes = !insideQuotes;

    command += char;
    index += 1;
  }

  return command;
};

export const agentEnv = (taskPath: string) => ({
  [PROMPT_ENV]: agentPrompt(taskPath),
  [FILE_ENV]: taskPath,
  [FINISHED_ENV]: finishedPath(taskPath),
});

export type AgentRunState = 'done' | 'open' | 'failed';

export type AgentRun = {
  task: UpdateTask;
  command: string;
  state: AgentRunState;
  reason?: string;
};

/** The tasks an agent can work on: the ones whose instructions were written as a prompt. */
export const assistedTasks = (tasks: readonly UpdateTask[]) =>
  tasks.filter((task) => task.kind === 'assisted' && task.instructionsFile !== undefined);

/** `settleMs` lets the agent print its last message after it writes the finished file; `killMs` is the SIGTERM grace. */
export type AgentTiming = { pollMs: number; settleMs: number; killMs: number };

const DEFAULT_TIMING: AgentTiming = { pollMs: 250, settleMs: 2000, killMs: 5000 };

/**
 * The shell and its children: `sh -c` does not always exec the command, so the shell can exit on SIGTERM
 * while the agent under it lives on.
 */
const processTree = (pid: number) => {
  if (process.platform === 'win32') return [pid];

  const children = spawnSync('pgrep', ['-P', String(pid)], { encoding: 'utf8' }).stdout ?? '';

  return [pid, ...children.split('\n').filter(Boolean).map(Number)];
};

const signal = (pid: number, name: 'SIGTERM' | 'SIGKILL') => {
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(pid), '/T', ...(name === 'SIGKILL' ? ['/F'] : [])], { stdio: 'ignore' });

    return;
  }

  try {
    process.kill(pid, name);
  } catch {
    return;
  }
};

const isAlive = (pid: number) => {
  try {
    process.kill(pid, 0);

    return true;
  } catch {
    return false;
  }
};

/** Alternate screen, mouse, focus events and bracketed paste off; kitty keyboard modes popped; cursor shown. */
const TERMINAL_RESET =
  '\x1b[?1049l\x1b[?1000l\x1b[?1002l\x1b[?1003l\x1b[?1006l\x1b[?1004l\x1b[?2004l\x1b[<10u\x1b[?25h';

/** An agent ended by a signal can leave the terminal raw with its screen modes on: Codex 0.157 does. */
const restoreTerminal = () => {
  if (process.stdout.isTTY) process.stdout.write(TERMINAL_RESET);

  if (process.platform !== 'win32' && process.stdin.isTTY) spawnSync('stty', ['sane'], { stdio: 'inherit' });
};

const ignoreInterrupt = () => undefined;

const wait = (ms: number, signal?: AbortSignal) => delay(ms, undefined, { signal }).catch(() => undefined);

const watchFor = async (options: { path: string; pollMs: number; signal: AbortSignal }) => {
  const { path, pollMs, signal } = options;

  while (!signal.aborted) {
    if (existsSync(path)) return true;

    await wait(pollMs, signal);
  }

  return false;
};

const endTree = async (pid: number, timing: AgentTiming) => {
  const targets = processTree(pid);
  const started = Date.now();
  let killed = false;

  targets.forEach((target) => signal(target, 'SIGTERM'));

  while (targets.some(isAlive)) {
    if (!killed && Date.now() - started >= timing.killMs) {
      killed = true;
      targets.filter(isAlive).forEach((target) => signal(target, 'SIGKILL'));
    }

    await wait(timing.pollMs);
  }
};

const runOne = async (options: {
  root: string;
  template: string;
  task: UpdateTask;
  timing: AgentTiming;
}): Promise<AgentRun> => {
  const { root, template, task, timing } = options;
  const taskPath = join(root, task.instructionsFile ?? '');
  const finishedFile = finishedPath(taskPath);
  const command = agentCommand({ template });

  console.log(`  ${command}\n  ${FILE_ENV}=${taskPath}\n`);

  rmSync(finishedFile, { force: true });

  // Ctrl+C belongs to the agent while it runs: an interactive CLI uses it to cancel, not to quit.
  process.on('SIGINT', ignoreInterrupt);

  const child = spawn(command, {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, ...agentEnv(taskPath) },
  });
  const exited = new AbortController();
  const exit = new Promise<{ status: number | null; error?: Error }>((resolve) => {
    child.on('error', (error) => resolve({ status: null, error }));
    child.on('exit', (status) => resolve({ status }));
  }).finally(() => exited.abort());
  let ended = false;

  if (await watchFor({ path: finishedFile, pollMs: timing.pollMs, signal: exited.signal })) {
    console.log('\n  The agent is finished, so et update ends the session.');

    await wait(timing.settleMs, exited.signal);

    if (!exited.signal.aborted && child.pid !== undefined) {
      ended = true;
      await endTree(child.pid, timing);
    }
  }

  const { status, error } = await exit;

  process.off('SIGINT', ignoreInterrupt);

  if (ended) restoreTerminal();

  rmSync(finishedFile, { force: true });

  if (error) return { task, command, state: 'failed', reason: error.message };

  if (!ended && status !== 0) return { task, command, state: 'failed', reason: `exited with ${status}` };

  if (existsSync(taskPath)) {
    return { task, command, state: 'open', reason: `the agent left ${task.instructionsFile}, so the task stays open` };
  }

  return { task, command, state: 'done' };
};

/**
 * Runs the configured agent once per assisted task, in order, so each run has one change to make, and
 * reports each one as it ends. The command is a user-written string, so it runs through a shell.
 * A run ends when the agent exits, or shortly after it writes the finished file the prompt names.
 * `afterRun` runs after each task, before the next one starts; it is how `et update` commits a task that
 * ended done, so the report of any other task says it is not committed.
 */
export const runAgentTasks = async (options: {
  root: string;
  template: string;
  tasks: readonly UpdateTask[];
  afterRun?: (run: AgentRun) => void;
  timing?: Partial<AgentTiming>;
}): Promise<AgentRun[]> => {
  const { afterRun } = options;
  const { root, template } = options;
  const timing = { ...DEFAULT_TIMING, ...options.timing };
  const tasks = assistedTasks(options.tasks);
  const runs: AgentRun[] = [];

  for (const [index, task] of tasks.entries()) {
    const label = `[${index + 1}/${tasks.length}] ${task.packageName} ${task.name}`;

    console.log(
      `\n  ${label}\n  An interactive session ends by itself when the agent is finished. Type /exit to end it sooner.`,
    );

    const run = await runOne({ root, template, task, timing });

    if (run.state === 'done') console.log(`\n  ${label}: done`);
    else console.error(`\n  ${label}: ${run.reason}${afterRun ? ', so it is not committed' : ''}`);

    afterRun?.(run);
    runs.push(run);
  }

  return runs;
};
