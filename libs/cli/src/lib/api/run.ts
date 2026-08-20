import { spawnSync } from 'child_process';
import { composeToolNames, engineEnv, lanAddress, resolveComposeTool } from './compose';
import { ApiDefinitions, GIT_API_COMMANDS, apiCommandNames } from './definition';
import { checkoutApiBranch, pullApiBranch } from './git';
import { apiHelp } from './help';
import { resolveApiCheckout } from './resolve-checkout';
import { cloneApiRepo, isGitIgnored, DEFAULT_CHECKOUT_DIR } from './clone';
import { gitUrlHost, printPrivateDependencyHint } from './auth-hint';
import { askQuestion } from '../utils';
import { configuredApiRepoBranch, readLocalConfig } from '../config/local-config';

export type RunApiCommandOptions = {
  apis: ApiDefinitions;
  /** Arguments after the command name, for example `['up', 'hub', '--host']`. */
  argv: string[];
  root?: string;
  /** How the caller is invoked, used in the usage line. */
  invocation?: string;
};

const confirmClone = async (options: { problem: string; repoUrl: string; into: string }) => {
  const { problem, repoUrl, into } = options;

  if (!process.stdin.isTTY) {
    console.error(`${problem}\n\nRe-run with --clone to clone ${repoUrl} into ${into}.`);

    return false;
  }

  const answer = await askQuestion(`${problem}\n\nClone ${repoUrl}\ninto ${into}? [y/N] `);

  return /^y(es)?$/i.test(answer.trim());
};

const definedEntries = (record: Record<string, string | undefined>) =>
  Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined)) as Record<string, string>;

export const runApiCommand = async ({
  apis,
  argv,
  root = process.cwd(),
  invocation = 'et api',
}: RunApiCommandOptions): Promise<number> => {
  const exposeOnLan = argv.includes('--host');
  const [command, name] = argv.filter((arg) => !arg.startsWith('--'));
  const api = name === undefined ? undefined : apis[name];

  if (argv.includes('--help') || argv.includes('-h') || command === 'help') {
    console.log(apiHelp(apis, invocation));

    return 0;
  }

  if (command === undefined || name === undefined || !api) {
    console.error(apiHelp(apis, invocation));

    return 1;
  }

  const commands = apiCommandNames(api);

  if (!commands.includes(command)) {
    console.error(`Unknown command "${command}" for the ${name} API.\n\nCommands: ${commands.join(', ')}`);

    return 1;
  }

  const isGitCommand = GIT_API_COMMANDS.includes(command);
  const checkout = resolveApiCheckout({ root, name, api, requireCompose: !isGitCommand });

  if (checkout.legacyConfigWarning) {
    console.warn(`${checkout.legacyConfigWarning}\n`);
  }

  if (!checkout.ok) {
    if (!checkout.clonable) {
      console.error(checkout.problem);

      return 1;
    }

    const { repoUrl, into, branch } = checkout.clonable;
    const accepted =
      command === 'clone' ||
      argv.includes('--clone') ||
      (await confirmClone({ problem: checkout.problem, repoUrl, into }));

    if (!accepted) return 1;

    if (!isGitIgnored(root, into)) {
      console.warn(`\n${DEFAULT_CHECKOUT_DIR}/ is not gitignored. Add it before you commit anything.\n`);
    }

    const cloned = cloneApiRepo({ repoUrl, into, branch });

    if (cloned !== 0) {
      printPrivateDependencyHint({ repoHost: gitUrlHost(repoUrl) });

      return cloned;
    }

    if (command === 'clone') return 0;

    return runApiCommand({ apis, argv, root, invocation });
  }

  if (command === 'clone') {
    console.log(`${name} already has a checkout at ${checkout.checkout.repoPath}.`);

    return 0;
  }

  const { repoPath, composePath: cwd } = checkout.checkout;

  if (isGitCommand) {
    const expectedBranch = configuredApiRepoBranch(readLocalConfig(root).config, name);

    if (command === 'checkout') {
      if (!expectedBranch) {
        console.error(
          `No branch configured for "${name}". Add it to apiRepoBranches:\n\n` +
            `  {\n    "apiRepoBranches": {\n      "${name}": "main"\n    }\n  }`,
        );

        return 1;
      }

      return checkoutApiBranch({ repoPath, branch: expectedBranch });
    }

    return pullApiBranch({ repoPath, expectedBranch, force: argv.includes('--force') });
  }

  const tool = resolveComposeTool();

  if (!tool) {
    console.error(`No compose tool found. Tried: ${composeToolNames().join(', ')}.`);

    return 1;
  }

  const { engine, compose } = tool;
  const [binary, ...composePrefix] = compose;
  const env = { ...engineEnv(engine), ...process.env, ...definedEntries(api.env?.() ?? {}) };

  let exitCode = 0;

  const runCompose = (...composeArgs: string[]) => {
    const result = spawnSync(binary, [...composePrefix, ...composeArgs], { cwd, env, stdio: 'inherit' });

    if (result.error) {
      console.error(result.error.message);
      exitCode = 1;

      return;
    }

    exitCode = result.status ?? 1;
  };

  if (command === 'up') {
    if (api.network) {
      spawnSync(engine, ['network', 'create', api.network], { stdio: 'ignore' });
    }

    runCompose('up', '-d', ...api.services);

    // podman-compose exits 0 even when it fails to build or pull an image, so the state has to be
    // read back rather than inferred from the exit code.
    console.log(`\n${name} API at http://localhost:${api.port}. State:\n`);
    runCompose('ps');

    if (exposeOnLan) {
      const address = lanAddress();

      if (!address) {
        console.error('\nThis machine has no external IPv4 address, so the API cannot be reached over the network.');

        return 1;
      }

      const envKeyStep = api.envKey
        ? `\n  2. Run localStorage.setItem('${api.envKey}', 'http://${address}:${api.port}') on that device.`
        : '';

      console.log(
        `\nThe published ports already listen on every interface, so the API also answers on\n` +
          `http://${address}:${api.port}. Two more steps make another device use it:\n\n` +
          `  1. Serve the app with a host binding of 0.0.0.0.${envKeyStep}\n\n` +
          `A host firewall can still block port ${api.port}.`,
      );
    }
  } else if (command === 'down') {
    runCompose('down');
  } else if (command === 'logs') {
    runCompose('logs', '-f', api.execService);
  } else if (command === 'shell') {
    runCompose('exec', api.execService, 'bash');
  } else {
    runCompose('exec', api.execService, ...(api.exec?.[command] ?? []));

    if (exitCode !== 0) {
      printPrivateDependencyHint({ repoHost: api.repoUrl ? gitUrlHost(api.repoUrl) : undefined });
    }
  }

  return exitCode;
};
