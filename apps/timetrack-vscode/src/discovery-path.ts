import { INGEST_DISCOVERY_FILENAME } from '@ethlete/timetrack';

/** The application whose data directory holds the discovery file. It is the app's Tauri identifier. */
const IDENTIFIER = 'io.ethlete.timetrack';

export type DiscoveryEnvironment = {
  platform: NodeJS.Platform;
  home: string;
  env: Record<string, string | undefined>;
};

/**
 * Where the app's data directory is, by the same rules Tauri's `app_data_dir` uses.
 *
 * This has to agree with the app rather than be configurable: a reporter that looked in the wrong
 * place would report nothing, and the user would have no way to tell that from an app that is not
 * running. The environment variables come first for the same reason they do there — a machine that
 * moved its data directory moved the file with it.
 */
export const discoveryPathOf = (environment: DiscoveryEnvironment) => {
  const { platform, home, env } = environment;

  if (platform === 'darwin') return `${home}/Library/Application Support/${IDENTIFIER}/${INGEST_DISCOVERY_FILENAME}`;

  if (platform === 'win32') {
    const roaming = env['APPDATA'] ?? `${home}/AppData/Roaming`;

    return `${roaming}/${IDENTIFIER}/${INGEST_DISCOVERY_FILENAME}`;
  }

  const data = env['XDG_DATA_HOME'] || `${home}/.local/share`;

  return `${data}/${IDENTIFIER}/${INGEST_DISCOVERY_FILENAME}`;
};
