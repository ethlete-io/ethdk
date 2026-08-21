import { spawnSync } from 'child_process';
import { join } from 'path';
import { UpdateTask } from './tasks';

/** Where the agent command sits in `ethlete.config.local.json`. */
export const AGENT_COMMAND_KEY = 'updateAgentCommand';

/** What the command template is asked to hold, so the prompt can go anywhere in it. */
export const PROMPT_PLACEHOLDER = '<prompt>';

/**
 * The command that hands one task to an agent. `<prompt>` becomes the path of the task file; a template
 * without it gets the path appended, which is what a plain `claude -p` needs.
 */
export const agentCommand = (options: { template: string; promptPath: string }) => {
  const { template, promptPath } = options;
  const quoted = /\s/.test(promptPath) ? `"${promptPath}"` : promptPath;

  return template.includes(PROMPT_PLACEHOLDER)
    ? template.split(PROMPT_PLACEHOLDER).join(quoted)
    : `${template} ${quoted}`;
};

export type AgentRun = {
  task: UpdateTask;
  command: string;
  ok: boolean;
  reason?: string;
};

/** The tasks an agent can work on: the ones whose instructions were written as a prompt. */
export const assistedTasks = (tasks: readonly UpdateTask[]) =>
  tasks.filter((task) => task.kind === 'assisted' && task.instructionsFile !== undefined);

/**
 * Runs the configured agent once per assisted task, in order, so each run has one change to make. The
 * command is a user-written string, so it runs through a shell.
 */
export const runAgentTasks = (options: {
  root: string;
  template: string;
  tasks: readonly UpdateTask[];
}): AgentRun[] => {
  const { root, template, tasks } = options;

  return assistedTasks(tasks).map((task) => {
    const command = agentCommand({ template, promptPath: join(root, task.instructionsFile ?? '') });

    console.log(`\n  ${command}`);

    const result = spawnSync(command, { cwd: root, stdio: 'inherit', shell: true });

    if (result.error) return { task, command, ok: false, reason: result.error.message };

    if (result.status !== 0) return { task, command, ok: false, reason: `exited with ${result.status}` };

    return { task, command, ok: true };
  });
};
