import { ApiDefinition, ApiDefinitions, BUILT_IN_API_COMMANDS, apiCommandNames } from './definition';

const BUILT_IN_DESCRIPTIONS: Record<(typeof BUILT_IN_API_COMMANDS)[number], string> = {
  up: 'Start the containers of the API',
  down: 'Stop them',
  logs: 'Follow the log of the API container, or of a service you name',
  shell: 'Open a shell in the API container, or in a service you name',
  clone: 'Clone the API into .ethlete/<name> from its repoUrl',
  clear: 'Remove the managed checkout in .ethlete/<name>',
  checkout: 'Switch the checkout to the branch apiRepoBranches names',
  pull: 'Fetch and fast-forward the checked-out branch',
  setup: "Run the API's own setupCommand in its compose directory",
};

const pad = (text: string, width: number) => text.padEnd(width);

/** The help text for `et api`, listing the built-in commands and what each API adds to them. */
export const apiHelp = (apis: ApiDefinitions, invocation: string) => {
  const entries = Object.entries(apis);
  const width = Math.max(8, ...entries.map(([name]) => name.length));
  const commandWidth = Math.max(
    8,
    ...BUILT_IN_API_COMMANDS.map((command) => command.length),
    ...entries.flatMap(([, api]) => Object.keys(api.exec ?? {}).map((command) => command.length)),
  );

  const apiLines = entries.map(([name, api]) => `  ${pad(name, width)}  ${apiCommandNames(api).join(', ')}`);

  const execNames = [...new Set(entries.flatMap(([, api]) => Object.keys(api.exec ?? {})))];

  return [
    `Usage: ${invocation} <command> <api>[,<api>] [--host]`,
    '',
    'Commands',
    ...BUILT_IN_API_COMMANDS.map((command) => `  ${pad(command, commandWidth)}  ${BUILT_IN_DESCRIPTIONS[command]}`),
    ...execNames.map((command) => `  ${pad(command, commandWidth)}  Declared by the API itself`),
    `  ${pad('help', commandWidth)}  What one API accepts, and where its checkout is`,
    '',
    'APIs',
    ...(apiLines.length > 0 ? apiLines : ['  none — declare them in ethlete.apis.js']),
    '',
    'Options',
    `  ${pad('--host', commandWidth)}  Also print the address another device on this network can use`,
    `  ${pad('--force', commandWidth)}  With up: start even when a port is taken. With pull or clear: lose local work`,
    `  ${pad('--all', commandWidth)}  With clear: every API at once`,
    `  ${pad('--clone', commandWidth)}  Clone a missing checkout without asking first`,
    `  ${pad('--setup', commandWidth)}  Run the setup command for a missing env file without asking first`,
    `  ${pad('--help', commandWidth)}  Show this text`,
  ].join('\n');
};

const commandDescription = (api: ApiDefinition, command: string) => {
  if (command === 'setup' && api.setupCommand) return `Run "${api.setupCommand}" in ${api.composeDir}`;

  const builtIn = BUILT_IN_API_COMMANDS.find((candidate) => candidate === command);

  return builtIn ? BUILT_IN_DESCRIPTIONS[builtIn] : (api.exec?.[command] ?? []).join(' ');
};

/** The help text for one API: every command it accepts, what each one runs, and where its files are. */
export const singleApiHelp = (options: {
  name: string;
  api: ApiDefinition;
  invocation: string;
  /** Where the checkout is, or what is wrong with it. */
  checkout?: string;
}) => {
  const { name, api, invocation, checkout } = options;
  const commands = apiCommandNames(api);
  const width = Math.max(8, ...commands.map((command) => command.length));

  return [
    `Usage: ${invocation} <command> ${name} [--host]`,
    '',
    'Commands',
    ...commands.map((command) => `  ${pad(command, width)}  ${commandDescription(api, command)}`),
    '',
    'This API',
    `  ${pad('url', width)}  http://localhost:${api.port}`,
    `  ${pad('services', width)}  ${api.services.join(', ')}`,
    ...(api.envFile ? [`  ${pad('env file', width)}  ${api.composeDir}/${api.envFile}`] : []),
    ...(api.envKey ? [`  ${pad('envKey', width)}  ${api.envKey}`] : []),
    ...(checkout ? ['', 'Checkout', ...checkout.split('\n').map((line) => `  ${line}`)] : []),
  ].join('\n');
};
