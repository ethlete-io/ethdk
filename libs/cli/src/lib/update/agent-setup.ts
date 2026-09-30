import { accessSync, constants, writeFileSync } from 'fs';
import { delimiter, join } from 'path';
import { LEGACY_LOCAL_CONFIG_FILE_NAME, LOCAL_CONFIG_FILE_NAME, readLocalConfigFile } from '../config/local-config';
import { askQuestion } from '../utils';
import { AGENT_COMMAND_EXAMPLE, AGENT_COMMAND_KEY } from './ai';
import { ignoreEntry } from './gitignore';

export type AgentCli = {
  binary: string;
  label: string;
  /** Opens a session the developer can answer questions in, and exits when they close it. */
  interactive: string;
  /** Runs to the end without a question, so a task that needs a decision stays open. */
  headless: string;
};

export const AGENT_CLIS: readonly AgentCli[] = [
  {
    binary: 'claude',
    label: 'Claude Code',
    interactive: 'claude --permission-mode acceptEdits',
    headless: 'claude --permission-mode acceptEdits -p',
  },
  {
    binary: 'codex',
    label: 'Codex',
    interactive: 'codex --sandbox workspace-write',
    headless: 'codex exec --sandbox workspace-write',
  },
  {
    binary: 'gemini',
    label: 'Gemini CLI',
    interactive: 'gemini --approval-mode auto_edit -i',
    headless: 'gemini --approval-mode auto_edit -p',
  },
  {
    binary: 'copilot',
    label: 'GitHub Copilot CLI',
    interactive: 'copilot --allow-all-tools -i',
    headless: 'copilot --allow-all-tools -p',
  },
  {
    binary: 'cursor-agent',
    label: 'Cursor Agent',
    interactive: 'cursor-agent --force',
    headless: 'cursor-agent --force -p',
  },
];

export type AgentChoice = { label: string; command: string };

const isExecutable = (path: string, platform: NodeJS.Platform) => {
  try {
    accessSync(path, platform === 'win32' ? constants.F_OK : constants.X_OK);

    return true;
  } catch {
    return false;
  }
};

export const onPath = (options: { binary: string; env?: NodeJS.ProcessEnv; platform?: NodeJS.Platform }) => {
  const { binary, env = process.env, platform = process.platform } = options;
  const dirs = (env['PATH'] ?? env['Path'] ?? '').split(delimiter).filter(Boolean);
  const extensions = platform === 'win32' ? ['', ...(env['PATHEXT'] ?? '.EXE;.CMD;.BAT').split(';')] : [''];

  return dirs.some((dir) => extensions.some((extension) => isExecutable(join(dir, binary + extension), platform)));
};

/** The commands of every installed agent CLI, the interactive one of each first. */
export const agentChoices = (options: { env?: NodeJS.ProcessEnv; platform?: NodeJS.Platform } = {}): AgentChoice[] =>
  AGENT_CLIS.filter(({ binary }) => onPath({ binary, ...options })).flatMap((cli) => [
    { label: `${cli.label}, interactive: you can answer its questions`, command: cli.interactive },
    { label: `${cli.label}, headless: a task that needs a decision stays open`, command: cli.headless },
  ]);

const missingKeyMessage = `--ai needs "${AGENT_COMMAND_KEY}" in ${LOCAL_CONFIG_FILE_NAME}, for example "${AGENT_COMMAND_EXAMPLE}".`;

const pick = async (choices: readonly AgentChoice[]) => {
  const list = choices.map((choice, index) => `  ${index + 1}. ${choice.label}\n     ${choice.command}`).join('\n');
  const question =
    choices.length > 0
      ? `${list}\n\nPick a number, or type a command of your own. Press Enter for 1, or Ctrl+C to stop: `
      : 'No agent CLI was found on PATH. Type the command to hand a task to, or press Enter to stop: ';

  const answer = (await askQuestion(`\n${missingKeyMessage}\n\n${question}`)).trim();

  if (answer === '') return choices[0]?.command;

  const index = /^\d+$/.test(answer) ? Number(answer) - 1 : -1;

  if (index >= 0) return choices[index]?.command;

  return answer;
};

/** The file the key goes in: the one that holds the local config now, or a new `ethlete.config.local.json`. */
const targetFile = (root: string) => {
  const primary = readLocalConfigFile(join(root, LOCAL_CONFIG_FILE_NAME));

  if (primary.status === 'ok') return { fileName: LOCAL_CONFIG_FILE_NAME, config: primary.config };

  if (primary.status !== 'absent') return undefined;

  const legacy = readLocalConfigFile(join(root, LEGACY_LOCAL_CONFIG_FILE_NAME));

  if (legacy.status === 'ok') return { fileName: LEGACY_LOCAL_CONFIG_FILE_NAME, config: legacy.config };

  return { fileName: LOCAL_CONFIG_FILE_NAME, config: {} };
};

/**
 * Asks which agent command `--ai` uses and saves the answer in the local config. Without a terminal it
 * names the key and the installed CLIs instead. Returns `undefined` when there is no command to use.
 */
export const setUpAgentCommand = async (options: {
  root: string;
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  isTTY?: boolean;
}) => {
  const { root, isTTY = process.stdin.isTTY === true } = options;
  const choices = agentChoices(options);

  if (!isTTY) {
    const found = choices.map(({ command }) => `  ${command}`).join('\n');

    console.error(
      `${missingKeyMessage}\n` +
        (found ? `Commands for the agent CLIs on PATH:\n${found}\n` : '') +
        'Nothing was changed.',
    );

    return undefined;
  }

  const target = targetFile(root);

  if (!target) {
    console.error(
      `${missingKeyMessage}\n${LOCAL_CONFIG_FILE_NAME} cannot be read, so it stays as it is. Nothing was changed.`,
    );

    return undefined;
  }

  const command = await pick(choices);

  if (!command) {
    console.error('No agent command was picked. Nothing was changed.');

    return undefined;
  }

  writeFileSync(
    join(root, target.fileName),
    `${JSON.stringify({ ...target.config, [AGENT_COMMAND_KEY]: command }, null, 2)}\n`,
    'utf8',
  );
  console.log(`\n  Saved "${AGENT_COMMAND_KEY}": "${command}" in ${target.fileName}.`);

  if (ignoreEntry({ root, entry: target.fileName })) console.log(`  Added ${target.fileName} to .gitignore.`);

  return command;
};
