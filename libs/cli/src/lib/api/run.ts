import { spawnSync } from 'child_process';
import {
  ComposeCall,
  composeContainerIds,
  composeOutput,
  composeToolNames,
  containerStates,
  engineEnv,
  lanAddress,
  resolveComposeTool,
} from './compose';
import {
  ApiDefinition,
  ApiDefinitions,
  GIT_API_COMMANDS,
  apiCommandNames,
  dependencyInstallCommandName,
  installsDependencies,
} from './definition';
import { checkoutApiBranch, pullApiBranch } from './git';
import { apiHelp, singleApiHelp } from './help';
import { checkoutProblem, resolveApiCheckout } from './resolve-checkout';
import { runApiSetup } from './setup';
import { didYouMean } from './suggest';
import { cloneApiRepo, isGitIgnored, DEFAULT_CHECKOUT_DIR } from './clone';
import { gitUrlHost, printPrivateDependencyHint } from './auth-hint';
import { confirm } from '../utils';
import { configuredApiRepoBranch, readLocalConfig } from '../config/local-config';
import { clearApiCheckouts } from './clear';
import { portsInUse, publishedPorts } from './ports';
import { serviceStateTable, serviceStates } from './state';

export type RunApiCommandOptions = {
  apis: ApiDefinitions;
  /** Arguments after the command name, for example `['up', 'hub', '--host']`. */
  argv: string[];
  root?: string;
  /** How the caller is invoked, used in the usage line. */
  invocation?: string;
};

const confirmFix = (options: { problem: string; question: string; hint: string }) =>
  confirm({ ...options, defaultsToYes: true });

const definedEntries = (record: Record<string, string | undefined>) =>
  Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined)) as Record<string, string>;

const namedApis = (argument: string) =>
  argument
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name !== '');

const composeProjectHasContainers = (composePath: string) => {
  const tool = resolveComposeTool();

  return tool ? (composeContainerIds({ tool, cwd: composePath }) ?? []).length > 0 : false;
};

const takeComposeProjectDown = (composePath: string) => {
  const tool = resolveComposeTool();

  if (!tool) return false;

  const [binary, ...prefix] = tool.compose;
  const result = spawnSync(binary, [...prefix, 'down'], {
    cwd: composePath,
    env: { ...engineEnv(tool.engine), ...process.env },
    stdio: 'inherit',
  });

  return !result.error && result.status === 0;
};

type SingleApiOptions = {
  argv: string[];
  root: string;
  invocation: string;
  command: string;
  name: string;
  api: ApiDefinition;
  service: string | undefined;
};

const runOneApiCommand = async (options: SingleApiOptions): Promise<number> => {
  const { argv, root, invocation, command, name, api, service } = options;
  const exposeOnLan = argv.includes('--host');

  const isGitCommand = GIT_API_COMMANDS.includes(command);
  const checkout = resolveApiCheckout({
    root,
    name,
    api,
    needs: isGitCommand ? 'repo' : command === 'setup' ? 'compose' : 'env',
  });

  if (checkout.legacyConfigWarning) {
    console.warn(`${checkout.legacyConfigWarning}\n`);
  }

  if (!checkout.ok) {
    if (checkout.clonable) {
      const { repoUrl, into, branch } = checkout.clonable;
      const accepted =
        command === 'clone' ||
        argv.includes('--clone') ||
        (await confirmFix({
          problem: checkout.problem,
          question: `Clone ${repoUrl}\ninto ${into}?`,
          hint: `Re-run with --clone to clone ${repoUrl} into ${into}.`,
        }));

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

      return runOneApiCommand(options);
    }

    if (checkout.setupable) {
      const { setupCommand, composePath } = checkout.setupable;
      const accepted =
        argv.includes('--setup') ||
        (await confirmFix({
          problem: checkout.problem,
          question: `Run "${setupCommand}" in ${composePath}?`,
          hint: `Re-run with --setup to run "${setupCommand}" in ${composePath}.`,
        }));

      if (!accepted) return 1;

      const prepared = runApiSetup(checkout.setupable);

      if (prepared !== 0) return prepared;

      return runOneApiCommand(options);
    }

    console.error(checkout.problem);

    return 1;
  }

  if (command === 'clone') {
    console.log(`${name} already has a checkout at ${checkout.checkout.repoPath}.`);

    return 0;
  }

  const { repoPath, composePath: cwd } = checkout.checkout;

  if (command === 'setup') {
    if (!api.setupCommand) {
      console.error(`The ${name} API declares no setupCommand.`);

      return 1;
    }

    return runApiSetup({ setupCommand: api.setupCommand, composePath: cwd, envFile: api.envFile });
  }

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

  const call: ComposeCall = { tool, cwd, env };

  /** Ports another program already holds. Empty while this project has containers, because `up` then reconciles its own. */
  const takenPorts = async () => {
    const running = composeContainerIds(call);

    if (running === undefined || running.length > 0) return [];

    const config = composeOutput({ ...call, args: ['config'] });

    return config === undefined ? [] : portsInUse(publishedPorts({ config, services: api.services }));
  };

  const freePorts = async (taken: number[]) => {
    const containers = containerStates(engine);
    const holders = taken.map((port) => ({
      port,
      container: containers.find(({ ports }) => ports.some(({ host }) => host === port))?.name,
    }));
    const rows = holders.map(({ port, container }) => `  ${port}  ${container ?? 'held by another program'}`);
    const problem = `Cannot start ${name}. These ports are already in use:\n\n${rows.join('\n')}`;
    const names = [...new Set(holders.map(({ container }) => container))].filter((holder) => holder !== undefined);

    if (holders.some(({ container }) => container === undefined)) {
      console.error(`${problem}\n\nRe-run with --force to start ${name} anyway.`);

      return false;
    }

    const accepted = await confirm({
      problem,
      question: `Stop ${names.join(', ')} and start ${name}?`,
      hint: `Stop them with "${engine} stop ${names.join(' ')}", or re-run with --force to start ${name} anyway.`,
      defaultsToYes: true,
    });

    if (!accepted) return false;

    return (spawnSync(engine, ['stop', ...names], { stdio: 'inherit' }).status ?? 1) === 0;
  };

  if (command === 'up') {
    const taken = argv.includes('--force') ? [] : await takenPorts();

    if (taken.length > 0 && !(await freePorts(taken))) return 1;

    if (api.network) {
      spawnSync(engine, ['network', 'create', api.network], { stdio: 'ignore' });
    }

    console.log(`Starting ${name}: ${api.services.join(', ')}.`);

    const started = spawnSync(binary, [...composePrefix, 'up', '-d', ...api.services], { cwd, env, encoding: 'utf8' });
    const startedOutput = `${started.stdout ?? ''}\n${started.stderr ?? ''}`.trim();

    if (started.error) {
      console.error(started.error.message);

      return 1;
    }

    if (started.status !== 0) {
      if (startedOutput) console.error(startedOutput);

      return started.status ?? 1;
    }

    // podman-compose exits 0 even when it fails to build or pull an image, so the state has to be
    // read back rather than inferred from the exit code.
    const ids = composeContainerIds(call) ?? [];
    const ours = containerStates(engine).filter((container) =>
      ids.some((id) => id.startsWith(container.id) || container.id.startsWith(id)),
    );
    const states = serviceStates({ services: api.services, containers: ours });
    const stopped = states.filter(({ running }) => !running);

    console.log(`\n${name} API at http://localhost:${api.port}\n`);
    console.log(serviceStateTable(states));

    if (stopped.length > 0) {
      const which = stopped.map((state) => state.service).join(', ');
      const exited = stopped.filter(({ status }) => status !== 'no container');

      console.error(`\n${which} ${stopped.length === 1 ? 'is' : 'are'} not running.`);

      for (const state of exited) {
        console.error(`Run "${invocation} logs ${name} ${state.service}" to see why.`);
      }

      // A service with no container never logged anything, so the output of `up` is the only place
      // a failed pull or build is reported.
      if (exited.length < stopped.length && startedOutput) console.error(`\n${startedOutput}`);

      exitCode = 1;
    }

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
  } else if (command === 'logs' || command === 'shell') {
    if (service !== undefined && !api.services.includes(service)) {
      console.error(
        `The ${name} API does not start "${service}".${didYouMean(service, api.services)}\n\n` +
          `Services: ${api.services.join(', ')}`,
      );

      return 1;
    }

    const target = service ?? api.execService;

    if (command === 'logs') runCompose('logs', '-f', target);
    else runCompose('exec', target, 'bash');
  } else {
    const execCommand = api.exec?.[command] ?? [];

    runCompose('exec', api.execService, ...execCommand);

    if (exitCode !== 0) {
      const install = dependencyInstallCommandName(api);

      if (installsDependencies(execCommand)) {
        printPrivateDependencyHint({ repoHost: api.repoUrl ? gitUrlHost(api.repoUrl) : undefined });
      } else if (install !== undefined) {
        console.error(
          `\nIf the ${api.execService} container has no dependencies installed yet, ` +
            `run "${invocation} ${install} ${name}" first.`,
        );
      }
    }
  }

  return exitCode;
};

export const runApiCommand = async ({
  apis,
  argv,
  root = process.cwd(),
  invocation = 'et api',
}: RunApiCommandOptions): Promise<number> => {
  const [command, nameArgument, service] = argv.filter((arg) => !arg.startsWith('--'));
  const wantsHelp = argv.includes('--help') || argv.includes('-h') || command === 'help';

  if (wantsHelp && nameArgument === undefined) {
    console.log(apiHelp(apis, invocation));

    return 0;
  }

  const clear = (names: string[]) =>
    clearApiCheckouts({
      apis,
      names,
      root,
      invocation,
      force: argv.includes('--force'),
      hasContainers: composeProjectHasContainers,
      takeDown: takeComposeProjectDown,
    });

  if (command === 'clear' && argv.includes('--all')) return clear(Object.keys(apis));

  const names = nameArgument === undefined ? [] : namedApis(nameArgument);

  if (command === undefined || names.length === 0) {
    console.error(apiHelp(apis, invocation));

    return 1;
  }

  const known = Object.keys(apis);
  const unknown = names.find((candidate) => apis[candidate] === undefined);

  if (unknown !== undefined) {
    console.error(
      known.length === 0
        ? apiHelp(apis, invocation)
        : `Unknown API "${unknown}".${didYouMean(unknown, known)}\n\nAPIs: ${known.join(', ')}`,
    );

    return 1;
  }

  const targets = names.flatMap((name) => {
    const api = apis[name];

    return api === undefined ? [] : [{ name, api }];
  });

  if (wantsHelp) {
    const texts = targets.map(({ name, api }) => {
      const checkout = resolveApiCheckout({ root, name, api });

      return singleApiHelp({
        name,
        api,
        invocation,
        checkout: checkout.ok
          ? checkout.checkout.composePath
          : checkoutProblem({ failure: checkout, name, invocation }),
      });
    });

    console.log(texts.join('\n\n'));

    return 0;
  }

  const rejected = targets.find(({ api }) => !apiCommandNames(api).includes(command));

  if (rejected) {
    const commands = apiCommandNames(rejected.api);

    console.error(
      `Unknown command "${command}" for the ${rejected.name} API.${didYouMean(command, commands)}\n\n` +
        `Commands: ${commands.join(', ')}`,
    );

    return 1;
  }

  if (command === 'clear') return clear(names);

  let exitCode = 0;

  for (const { name, api } of targets) {
    const code = await runOneApiCommand({ argv, root, invocation, command, name, api, service });

    if (code !== 0) exitCode = code;
  }

  return exitCode;
};
