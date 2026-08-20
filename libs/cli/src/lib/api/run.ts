import { spawnSync } from 'child_process';
import { existsSync, statSync } from 'fs';
import { join } from 'path';
import {
  LEGACY_LOCAL_CONFIG_FILE_NAME,
  LOCAL_CONFIG_FILE_NAME,
  configuredApiRepoPath,
  readLocalConfig,
  resolveConfiguredPath,
} from '../config/local-config';
import { composeToolNames, engineEnv, lanAddress, resolveComposeTool } from './compose';
import { ApiDefinition, ApiDefinitions, apiCommandNames } from './definition';

export type RunApiCommandOptions = {
  apis: ApiDefinitions;
  /** Arguments after the command name, for example `['up', 'hub', '--host']`. */
  argv: string[];
  root?: string;
  /** How the caller is invoked, used in the usage line. */
  invocation?: string;
};

type ConfigHelp = { name: string; api: ApiDefinition; reason: string };

const configHelp = ({ name, api, reason }: ConfigHelp) =>
  `${reason}\n\nAdd the path of your ${name} API checkout to ${LOCAL_CONFIG_FILE_NAME} in the repo ` +
  `root. The file is gitignored, so it changes nothing for anyone else:\n\n` +
  `  {\n    "apiRepoPaths": {\n      "${name}": "${api.examplePath ?? `../${name}-api`}"\n    }\n  }`;

const definedEntries = (record: Record<string, string | undefined>) =>
  Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined)) as Record<string, string>;

const isDirectory = (path: string) => existsSync(path) && statSync(path).isDirectory();

export const runApiCommand = ({ apis, argv, root = process.cwd(), invocation = 'et api' }: RunApiCommandOptions) => {
  const exposeOnLan = argv.includes('--host');
  const [command, name] = argv.filter((arg) => !arg.startsWith('--'));
  const api = name === undefined ? undefined : apis[name];

  if (command === undefined || name === undefined || !api) {
    console.error(`Usage: ${invocation} <command> <api> [--host]\n\nAPIs: ${Object.keys(apis).join(', ')}`);

    return 1;
  }

  const commands = apiCommandNames(api);

  if (!commands.includes(command)) {
    console.error(`Unknown command "${command}" for the ${name} API.\n\nCommands: ${commands.join(', ')}`);

    return 1;
  }

  const { config, fileName, isLegacy } = readLocalConfig(root);
  const configured = configuredApiRepoPath(config, name);

  if (!configured) {
    console.error(
      configHelp({
        name,
        api,
        reason: fileName
          ? `${fileName} has no apiRepoPaths entry for "${name}".`
          : `${LOCAL_CONFIG_FILE_NAME} does not exist.`,
      }),
    );

    return 1;
  }

  if (isLegacy) {
    console.warn(
      `${LEGACY_LOCAL_CONFIG_FILE_NAME} still holds "apiRepoPaths". Move it to ${LOCAL_CONFIG_FILE_NAME}.\n`,
    );
  }

  const repoPath = resolveConfiguredPath(root, configured);

  if (!isDirectory(repoPath)) {
    console.error(`apiRepoPaths.${name} points at ${repoPath}, which is not a directory that exists.`);

    return 1;
  }

  const cwd = join(repoPath, api.composeDir);

  if (!isDirectory(cwd)) {
    console.error(`${repoPath} has no ${api.composeDir} directory. Is apiRepoPaths.${name} the right checkout?`);

    return 1;
  }

  if (api.envFile && !existsSync(join(cwd, api.envFile))) {
    console.error(
      `Missing ${api.envFile} in ${cwd}.${api.setupCommand ? ` Run "${api.setupCommand}" there first.` : ''}`,
    );

    return 1;
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
  }

  return exitCode;
};
