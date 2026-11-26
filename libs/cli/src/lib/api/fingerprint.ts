import { createHash } from 'crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { API_DEFINITIONS_FILE_NAMES } from './load-definitions';
import { headCommit } from './git';
import { seedDirectory } from './seeds';

export const NO_GIT = 'no-git';

const FINGERPRINT_LENGTH = 12;

/** The major version of this CLI, so a change to what `ready` does invalidates every snapshot. */
export const cliMajorVersion = () => {
  const manifest = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'package.json'), 'utf8')) as {
    version?: string;
  };

  return manifest.version?.split('.')[0] ?? '0';
};

const filesUnder = (directory: string): string[] => {
  if (!existsSync(directory)) return [];

  const walk = (relative: string): string[] =>
    readdirSync(join(directory, relative))
      .sort()
      .flatMap((entry) => {
        const name = relative === '' ? entry : `${relative}/${entry}`;
        const stats = statSync(join(directory, name));

        return stats.isDirectory() ? walk(name) : stats.isFile() ? [name] : [];
      });

  return walk('');
};

/**
 * A 12 character hash of everything a profile's data is built from: the API checkout's commit, its
 * migrations, the repo's seed files, the profile's seed list, `ethlete.apis.js` and the CLI major version.
 */
export const fingerprintApi = (options: {
  /** The repo root that holds `ethlete.apis.js` and `.ethlete/seeds`. */
  root: string;
  name: string;
  /** The API checkout root, not its compose directory. */
  repoPath: string;
  migrationsDir?: string;
  seeds: readonly string[];
  cliMajor?: string;
  head?: (repoPath: string) => string | undefined;
}) => {
  const { root, name, repoPath, migrationsDir, seeds, cliMajor = cliMajorVersion(), head = headCommit } = options;
  const hash = createHash('sha256');
  const add = (label: string, value: string | Buffer) => {
    hash.update(`${label}\0${value.length}\0`);
    hash.update(value);
    hash.update('\0');
  };
  const addFiles = (label: string, directory: string) => {
    for (const file of filesUnder(directory)) {
      add(`${label}:name`, file);
      add(`${label}:content`, readFileSync(join(directory, file)));
    }
  };

  add('head', head(repoPath) ?? NO_GIT);

  if (migrationsDir !== undefined) addFiles('migrations', join(repoPath, migrationsDir));

  addFiles('seeds', seedDirectory(root, name));
  add('profile-seeds', JSON.stringify(seeds));

  for (const fileName of API_DEFINITIONS_FILE_NAMES) {
    if (existsSync(join(root, fileName))) add(`definitions:${fileName}`, readFileSync(join(root, fileName)));
  }

  add('cli', cliMajor);

  return hash.digest('hex').slice(0, FINGERPRINT_LENGTH);
};
