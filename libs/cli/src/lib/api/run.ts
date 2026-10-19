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
import { runDoctor } from './doctor';
import { runApiSetup } from './setup';
import { parseApiArgv } from './parse-argv';
import { didYouMean } from './suggest';
import { cloneApiRepo, DEFAULT_CHECKOUT_DIR } from './clone';
import { ignoredByGit } from './git';
import { ignoreEntry } from '../update/gitignore';
import {
  SEED_API_COMMANDS,
  SeedStep,
  containerSeedDirectory,
  parseSeedList,
  readSeedManifest,
  seedCopyArgs,
  seedDirectory,
  seedListText,
  seedManifestPath,
  seedRunArgs,
  seedSteps,
  tarDirectory,
} from './seeds';
import { gitUrlHost, printPrivateDependencyHint } from './auth-hint';
import { confirm } from '../utils';
import { configuredApiRepoBranch, readLocalConfig } from '../config/local-config';
import { clearApiCheckouts } from './clear';
import { portsInUse, publishedPorts } from './ports';
import { serviceStateTable, serviceStates } from './state';
import { markApiStateDirty } from './api-state';
import { runLocked } from './run-locked';
import { runSnapshotCommand } from './run-snapshot';
import { runStatusCommand } from './run-status';
import { runReadyCommand } from './run-ready';
import { definedEntries, stateDirectoryOf } from './api-context';

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

const namedApis = (argument: string) =>
  argument
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name !== '');

const parseWait = (wait: string | undefined) => {
  if (wait === undefined) return { ok: true as const, seconds: undefined };

  const seconds = Number(wait);

  return wait.trim() !== '' && Number.isFinite(seconds) && seconds >= 0
    ? { ok: true as const, seconds }
    : { ok: false as const };
};

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
  seedSteps?: SeedStep[];
  commandArgs?: string[];
};

const runOneApiCommand = async (options: SingleApiOptions): Promise<number> => {
  const { argv, root, invocation, command, name, api, service, seedSteps: steps, commandArgs = [] } = options;
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

      const ignoreLine = `/${DEFAULT_CHECKOUT_DIR}/${name}/`;

      if (ignoreEntry({ root, entry: ignoreLine, probe: `${DEFAULT_CHECKOUT_DIR}/${name}/` })) {
        console.log(`\nAdded ${ignoreLine} to .gitignore.`);
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

    const started = spawnSync(binary, [...composePrefix, 'up', '-d', ...api.services], {
      cwd,
      env,
      encoding: 'utf8',
      maxBuffer: Infinity,
    });
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
  } else if (command === 'doctor') {
    exitCode = runDoctor({ name, api, tool, cwd, env, invocation, fix: argv.includes('--fix') }).ok ? 0 : 1;
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
  } else if (command === 'exec') {
    if (service === undefined || !api.services.includes(service)) {
      console.error(
        service === undefined
          ? `Name the service to run in: ${invocation} exec ${name} <service> -- <command>`
          : `The ${name} API does not start "${service}".${didYouMean(service, api.services)}`,
      );
      console.error(`Services: ${api.services.join(', ')}`);

      return 1;
    }

    runCompose('exec', '-T', service, ...commandArgs);
  } else if (steps !== undefined) {
    const directory = containerSeedDirectory(name);
    const copied = spawnSync(binary, [...composePrefix, ...seedCopyArgs(api.execService, directory)], {
      cwd,
      env,
      input: tarDirectory(seedDirectory(root, name)),
      stdio: ['pipe', 'inherit', 'inherit'],
    });

    if (copied.error || copied.status !== 0) {
      if (copied.error) console.error(copied.error.message);

      console.error(`Could not copy ${seedDirectory(root, name)} into the ${api.execService} container.`);

      return copied.status || 1;
    }

    for (const step of steps) {
      console.log(`\nRunning ${step.label} in ${api.execService}.`);
      runCompose(...seedRunArgs({ service: api.execService, directory, step, tty: process.stdin.isTTY === true }));

      if (exitCode !== 0) {
        console.error(`\n${step.label} failed with exit code ${exitCode}.`);

        return exitCode;
      }
    }
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
  argv: rawArgv,
  root = process.cwd(),
  invocation = 'et api',
}: RunApiCommandOptions): Promise<number> => {
  const parsed = parseApiArgv(rawArgv);
  const argv = parsed.head;
  const positionals =
    parsed.positionals[0] === 'snapshot' && ['save', 'restore'].includes(parsed.positionals[1] ?? '')
      ? ['snapshot', parsed.positionals[2], parsed.positionals[1], parsed.positionals[3]]
      : parsed.positionals;
  const [command, nameArgument, service] = positionals as (string | undefined)[];
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

  if (command === 'exec' && !wantsHelp) {
    if (names.length > 1) {
      console.error(`exec runs in one API at a time, but ${names.length} were named.`);

      return 1;
    }

    if (parsed.rest === undefined || parsed.rest.length === 0) {
      console.error(
        `exec needs a command after "--": ${invocation} exec ${names[0]} <service> -- <command> [<args>...]`,
      );

      return 1;
    }
  }

  const runUsage = `${invocation} run <api> --lock [--wait <seconds>] -- <command> [<args>...]`;

  if (command === 'run' && !wantsHelp) {
    if (names.length > 1) {
      console.error(`run locks one API at a time, but ${names.length} were named.`);

      return 1;
    }

    if (!argv.includes('--lock') || parsed.rest === undefined || parsed.rest.length === 0) {
      console.error(`run needs --lock and a command after "--": ${runUsage}`);

      return 1;
    }

    if (!parseWait(parsed.wait).ok) {
      console.error(`--wait takes a number of seconds: ${runUsage}`);

      return 1;
    }
  }

  const known = Object.keys(apis);
  const unknown = names.find((candidate) => !Object.prototype.hasOwnProperty.call(apis, candidate));

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

  if (command === 'run') {
    const [target] = targets;

    if (target === undefined) return 1;

    const state = stateDirectoryOf({ root, ...target });

    if (!state.ok) {
      console.error(checkoutProblem({ failure: state, name: target.name, invocation }));

      return 1;
    }

    return runLocked({
      directory: state.directory,
      command: parsed.rest ?? [],
      cwd: root,
      wait: parseWait(parsed.wait).seconds,
    });
  }

  if (command === 'ready') {
    const [target] = targets;

    if (target === undefined) return 1;

    if (targets.length > 1) {
      console.error(`ready works on one API at a time, but ${targets.length} were named.`);

      return 1;
    }

    if (!parseWait(parsed.wait).ok) {
      console.error(`--wait takes a number of seconds.`);

      return 1;
    }

    const single = { argv, root, invocation, name: target.name, api: target.api, service: undefined };

    return runReadyCommand({
      root,
      ...target,
      invocation,
      profile: parsed.profile,
      wait: parseWait(parsed.wait).seconds,
      up: () => runOneApiCommand({ ...single, command: 'up' }),
      runSeeds: (unit) =>
        unit.kind === 'exec'
          ? runOneApiCommand({ ...single, command: unit.name })
          : runOneApiCommand({ ...single, command: 'seed', seedSteps: unit.steps }),
    });
  }

  if (command === 'snapshot' || command === 'status') {
    const [target] = targets;

    if (target === undefined) return 1;

    if (targets.length > 1) {
      console.error(`${command} works on one API at a time, but ${targets.length} were named.`);

      return 1;
    }

    if (command === 'status') {
      return runStatusCommand({ root, ...target, invocation, profile: parsed.profile });
    }

    if (!parseWait(parsed.wait).ok) {
      console.error(`--wait takes a number of seconds.`);

      return 1;
    }

    return runSnapshotCommand({
      root,
      ...target,
      invocation,
      action: service,
      snapshotName: positionals[3],
      profile: parsed.profile,
      wait: parseWait(parsed.wait).seconds,
    });
  }

  const stepsByApi = new Map<string, SeedStep[]>();
  const isSeedCommand = SEED_API_COMMANDS.some((candidate) => candidate === command);

  for (const { name } of isSeedCommand ? targets.filter(({ api }) => !api.exec?.[command]) : []) {
    const manifest = readSeedManifest(root, name);

    if (!manifest.ok) {
      console.error(manifest.problem);

      return 1;
    }

    if (ignoredByGit(root, seedManifestPath(name)) === true) {
      console.warn(
        `${seedManifestPath(name)} is gitignored, so nobody else gets these seeds. Ignore only the managed ` +
          `checkout: replace the ${DEFAULT_CHECKOUT_DIR} line in .gitignore with "/${DEFAULT_CHECKOUT_DIR}/${name}/".\n`,
      );
    }

    const seedNames = parseSeedList(service);

    if (command === 'seed' && seedNames.length === 0) {
      console.log(seedListText({ api: name, manifest: manifest.value, invocation }));
      continue;
    }

    const steps = seedSteps({
      manifest: manifest.value,
      names: seedNames,
      withFixtures: command === 'fixtures',
      api: name,
    });

    if (!steps.ok) {
      console.error(steps.problem);

      return 1;
    }

    stepsByApi.set(name, steps.value);
  }

  let exitCode = 0;

  for (const { name, api } of targets) {
    const seedStepsOfApi = stepsByApi.get(name);

    if (isSeedCommand && !api.exec?.[command] && seedStepsOfApi === undefined) continue;

    const code = await runOneApiCommand({
      argv,
      root,
      invocation,
      command,
      name,
      api,
      service,
      seedSteps: seedStepsOfApi,
      commandArgs: parsed.rest,
    });

    if (isSeedCommand) {
      const state = stateDirectoryOf({ root, name, api });

      if (state.ok) markApiStateDirty(state.directory);
    }

    if (code !== 0) exitCode = code;
  }

  return exitCode;
};
