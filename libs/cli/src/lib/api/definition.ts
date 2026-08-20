/** One API this repo can run locally. Everything here describes the API's own compose setup. */
export type ApiDefinition = {
  /** Directory inside the API checkout that holds the compose file, for example `development`. */
  composeDir: string;
  /** Compose services to start. Leave out a service the app does not need, such as a bundled frontend. */
  services: string[];
  /** Service that `shell`, `logs` and every `exec` entry run in. */
  execService: string;
  /** Published host port, not the port inside the container. Used for the printed url. */
  port: number;
  /** File that must exist in `composeDir` before the API can start, for example `.env`. */
  envFile?: string;
  /** Command that creates `envFile`. Named in the error when the file is missing. */
  setupCommand?: string;
  /** External container network to create before the first `up`. */
  network?: string;
  /** Example path shown in the error that asks the developer to configure this API's checkout. */
  examplePath?: string;
  /** Where to clone this API from when the developer has no checkout of their own. */
  repoUrl?: string;
  /** localStorage key the app reads to pick its API. Printed by `--host`. */
  envKey?: string;
  /** Extra environment for every compose call. An undefined value is dropped rather than passed as "undefined". */
  env?: () => Record<string, string | undefined>;
  /** Named commands run in `execService`, for example `{ install: ['composer', 'install'] }`. */
  exec?: Record<string, string[]>;
};

export type ApiDefinitions = Record<string, ApiDefinition>;

export const BUILT_IN_API_COMMANDS = ['up', 'down', 'logs', 'shell', 'clone', 'checkout', 'pull'] as const;

/** These act on the checkout itself, so they run before `make setup` and need no container engine. */
export const GIT_API_COMMANDS: string[] = ['clone', 'checkout', 'pull'];

export const apiCommandNames = (api: ApiDefinition) => [...BUILT_IN_API_COMMANDS, ...Object.keys(api.exec ?? {})];
