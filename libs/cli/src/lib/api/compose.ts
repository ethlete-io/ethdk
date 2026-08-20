import { spawnSync } from 'child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'fs';
import { homedir, networkInterfaces, tmpdir } from 'os';
import { join } from 'path';

export type ComposeTool = {
  engine: string;
  /** The binary and its fixed arguments. Non-empty, so the first entry is always the binary. */
  compose: [string, ...string[]];
};

/**
 * SELinux denies a container read access to a bind mount that carries the host's own label, and API
 * repos mount their checkout without the `:z` that would relabel it. Disabling the label from here
 * keeps those checkouts untouched.
 */
const PODMAN_COMPOSE_ARGS = ['--podman-run-args=--security-opt label=disable'];

const COMPOSE_TOOLS: ComposeTool[] = [
  { engine: 'docker', compose: ['docker', 'compose'] },
  { engine: 'container', compose: ['container', 'compose'] },
  { engine: 'podman', compose: ['podman-compose', ...PODMAN_COMPOSE_ARGS] },
  { engine: 'podman', compose: ['podman', 'compose', ...PODMAN_COMPOSE_ARGS] },
];

/**
 * Podman refuses to resolve a short image name such as `mysql:8.0` without a TTY prompt when several
 * unqualified search registries are configured. API compose files use short names, so point podman
 * at one registry and turn the prompt off.
 */
const PODMAN_REGISTRIES_CONF = `unqualified-search-registries = ["docker.io"]\nshort-name-mode = "disabled"\n`;

let podmanRegistriesConfPath: string | undefined;

const writePodmanRegistriesConf = () => {
  podmanRegistriesConfPath ??= join(mkdtempSync(join(tmpdir(), 'ethlete-api-')), 'registries.conf');
  writeFileSync(podmanRegistriesConfPath, PODMAN_REGISTRIES_CONF, 'utf8');

  return podmanRegistriesConfPath;
};

export const composeBinary = (compose: string[]) => compose.filter((part) => !part.startsWith('--'));

const canRun = (command: string, args: string[]) => {
  const result = spawnSync(command, args, { stdio: 'ignore' });

  return result.error === undefined && result.status === 0;
};

/** Finds the first container tool on this machine that answers `<compose> version`. */
export const resolveComposeTool = (tools: ComposeTool[] = COMPOSE_TOOLS) =>
  tools.find(({ compose }) => {
    const [binary, ...rest] = composeBinary(compose);

    return binary !== undefined && canRun(binary, [...rest, 'version']);
  });

export const composeToolNames = (tools: ComposeTool[] = COMPOSE_TOOLS) =>
  tools.map(({ compose }) => composeBinary(compose).join(' '));

export const engineEnv = (engine: string) =>
  engine === 'podman' ? { CONTAINERS_REGISTRIES_CONF: writePodmanRegistriesConf() } : {};

export const lanAddress = () =>
  Object.values(networkInterfaces())
    .flat()
    .find((networkInterface) => networkInterface?.family === 'IPv4' && !networkInterface.internal)?.address;

/** Path of this machine's SSH key, for a compose file that mounts one into the API container. */
export const sshKeyPath = () =>
  [join(homedir(), '.ssh/id_ed25519'), join(homedir(), '.ssh/id_rsa')].find((path) => existsSync(path));
