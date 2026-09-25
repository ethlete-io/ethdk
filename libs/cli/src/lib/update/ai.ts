import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { UpdateTask } from './tasks';

/** Where the agent command sits in `ethlete.config.local.json`. */
export const AGENT_COMMAND_KEY = 'updateAgentCommand';

/** An agent command that can edit files without asking, for the docs and the error that names the key. */
export const AGENT_COMMAND_EXAMPLE = 'claude --permission-mode acceptEdits -p';

/** Where the command template takes the whole prompt. */
export const PROMPT_PLACEHOLDER = '<prompt>';

/** Where the command template takes only the path of the task file. */
export const FILE_PLACEHOLDER = '<file>';

/** The prompt one assisted task is handed to an agent with. */
export const agentPrompt = (taskPath: string) =>
  `Apply the migration task described in ${taskPath} to this repository. ` +
  'Follow its instructions, then delete that file once the change is complete.';

const quoted = (value: string) => (/\s/.test(value) ? `"${value}"` : value);

/**
 * The command that hands one task to an agent. `<prompt>` becomes the prompt, `<file>` the path of the
 * task file; a template with neither gets the prompt appended, which is what `claude -p` needs.
 */
export const agentCommand = (options: { template: string; taskPath: string }) => {
  const { template, taskPath } = options;
  const prompt = quoted(agentPrompt(taskPath));

  if (template.includes(PROMPT_PLACEHOLDER) || template.includes(FILE_PLACEHOLDER)) {
    return template.split(PROMPT_PLACEHOLDER).join(prompt).split(FILE_PLACEHOLDER).join(quoted(taskPath));
  }

  return `${template} ${prompt}`;
};

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
  const command = agentCommand({ template, taskPath });

  console.log(`  ${command}\n`);

  const result = spawnSync(command, { cwd: root, stdio: 'inherit', shell: true });

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
 */
export const runAgentTasks = (options: {
  root: string;
  template: string;
  tasks: readonly UpdateTask[];
}): AgentRun[] => {
  const { root, template } = options;
  const tasks = assistedTasks(options.tasks);

  return tasks.map((task, index) => {
    const label = `[${index + 1}/${tasks.length}] ${task.packageName} ${task.name}`;

    console.log(`\n  ${label}`);

    const run = runOne({ root, template, task });

    if (run.state === 'done') console.log(`\n  ${label}: done`);
    else console.error(`\n  ${label}: ${run.reason}`);

    return run;
  });
};
