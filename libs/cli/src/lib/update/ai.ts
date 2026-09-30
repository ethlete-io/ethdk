import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { UpdateTask } from './tasks';

/** Where the agent command sits in `ethlete.config.local.json`. */
export const AGENT_COMMAND_KEY = 'updateAgentCommand';

/** An interactive agent command that can edit files without asking, for the error that names the key. */
export const AGENT_COMMAND_EXAMPLE = 'claude --permission-mode auto';

/** Where the command template takes the whole prompt. */
export const PROMPT_PLACEHOLDER = '<prompt>';

/** Where the command template takes only the path of the task file. */
export const FILE_PLACEHOLDER = '<file>';

/** The prompt one assisted task is handed to an agent with. */
export const agentPrompt = (taskPath: string) =>
  `Apply the migration task described in ${taskPath} to this repository. ` +
  'Follow its instructions, then delete that file once the change is complete. ' +
  'Do not commit: et update commits your change. ' +
  'In an interactive session, end your last message with: ' +
  '"Type /exit to hand back to et update. It commits this change and starts the next task."';

export const PROMPT_ENV = 'ETHLETE_UPDATE_PROMPT';
export const FILE_ENV = 'ETHLETE_UPDATE_TASK_FILE';

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

export const agentEnv = (taskPath: string) => ({ [PROMPT_ENV]: agentPrompt(taskPath), [FILE_ENV]: taskPath });

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

const runOne = (options: { root: string; template: string; task: UpdateTask }): AgentRun => {
  const { root, template, task } = options;
  const taskPath = join(root, task.instructionsFile ?? '');
  const command = agentCommand({ template });

  console.log(`  ${command}\n  ${FILE_ENV}=${taskPath}\n`);

  const result = spawnSync(command, {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, ...agentEnv(taskPath) },
  });

  if (result.error) return { task, command, state: 'failed', reason: result.error.message };

  if (result.status !== 0) return { task, command, state: 'failed', reason: `exited with ${result.status}` };

  if (existsSync(taskPath)) {
    return { task, command, state: 'open', reason: `the agent left ${task.instructionsFile}, so the task stays open` };
  }

  return { task, command, state: 'done' };
};

/**
 * Runs the configured agent once per assisted task, in order, so each run has one change to make, and
 * reports each one as it ends. The command is a user-written string, so it runs through a shell.
 * `afterRun` runs after each task, before the next one starts; it is how `et update` commits a task that
 * ended done, so the report of any other task says it is not committed.
 */
export const runAgentTasks = (options: {
  root: string;
  template: string;
  tasks: readonly UpdateTask[];
  afterRun?: (run: AgentRun) => void;
}): AgentRun[] => {
  const { afterRun } = options;
  const { root, template } = options;
  const tasks = assistedTasks(options.tasks);

  return tasks.map((task, index) => {
    const label = `[${index + 1}/${tasks.length}] ${task.packageName} ${task.name}`;

    console.log(`\n  ${label}\n  When an interactive session has finished the task, type /exit to start the next one.`);

    const run = runOne({ root, template, task });

    if (run.state === 'done') console.log(`\n  ${label}: done`);
    else console.error(`\n  ${label}: ${run.reason}${afterRun ? ', so it is not committed' : ''}`);

    afterRun?.(run);

    return run;
  });
};
