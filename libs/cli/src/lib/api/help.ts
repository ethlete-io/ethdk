import { ApiDefinitions, BUILT_IN_API_COMMANDS, apiCommandNames } from './definition';

const BUILT_IN_DESCRIPTIONS: Record<(typeof BUILT_IN_API_COMMANDS)[number], string> = {
  up: 'Start the containers of the API',
  down: 'Stop them',
  logs: 'Follow the log of the API container',
  shell: 'Open a shell in the API container',
  clone: 'Clone the API into .ethlete/<name> from its repoUrl',
  checkout: 'Switch the checkout to the branch apiRepoBranches names',
  pull: 'Fetch and fast-forward the checked-out branch',
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
    '',
    'APIs',
    ...(apiLines.length > 0 ? apiLines : ['  none — declare them in ethlete.apis.js']),
    '',
    'Options',
    `  ${pad('--host', 8)}  Also print the address another device on this network can use`,
    `  ${pad('--force', 8)}  With pull: discard local commits and tracked changes on the branch`,
    `  ${pad('--clone', 8)}  Clone a missing checkout without asking first`,
    `  ${pad('--help', 8)}  Show this text`,
  ].join('\n');
};
