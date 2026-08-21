import { ApiDefinition, ApiDefinitions, BUILT_IN_API_COMMANDS, apiCommandNames } from './definition';

const BUILT_IN_DESCRIPTIONS: Record<(typeof BUILT_IN_API_COMMANDS)[number], string> = {
  up: 'Start the containers of the API',
  down: 'Stop them',
  logs: 'Follow the log of the API container',
  shell: 'Open a shell in the API container',
  clone: 'Clone the API into .ethlete/<name> from its repoUrl',
  checkout: 'Switch the checkout to the branch apiRepoBranches names',
  pull: 'Fetch and fast-forward the checked-out branch',
  setup: "Run the API's own setupCommand in its compose directory",
};

const pad = (text: string, width: number) => text.padEnd(width);

/** The help text for `et api`, listing the built-in commands and what each API adds to them. */
export const apiHelp = (apis: ApiDefinitions, invocation: string) => {
  const entries = Object.entries(apis);
  const width = Math.max(8, ...entries.map(([name]) => name.length));

  const apiLines = entries.map(([name, api]) => `  ${pad(name, width)}  ${apiCommandNames(api).join(', ')}`);

  const execNames = [...new Set(entries.flatMap(([, api]) => Object.keys(api.exec ?? {})))];

  return [
    `Usage: ${invocation} <command> <api> [--host]`,
    '',
    'Commands',
    ...BUILT_IN_API_COMMANDS.map((command) => `  ${pad(command, 8)}  ${BUILT_IN_DESCRIPTIONS[command]}`),
    ...execNames.map((command) => `  ${pad(command, 8)}  Declared by the API itself`),
    `  ${pad('help', 8)}  What one API accepts, and where its checkout is`,
    '',
    'APIs',
    ...(apiLines.length > 0 ? apiLines : ['  none — declare them in ethlete.apis.js']),
    '',
    'Options',
    `  ${pad('--host', 8)}  Also print the address another device on this network can use`,
    `  ${pad('--force', 8)}  With pull: discard local commits and tracked changes on the branch`,
    `  ${pad('--clone', 8)}  Clone a missing checkout without asking first`,
    `  ${pad('--setup', 8)}  Run the setup command for a missing env file without asking first`,
    `  ${pad('--help', 8)}  Show this text`,
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
