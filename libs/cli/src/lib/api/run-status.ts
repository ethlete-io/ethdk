import { stateDirectoryOf } from './api-context';
import { readApiState } from './api-state';
import { ApiDefinition } from './definition';
import { fingerprintApi } from './fingerprint';
import { existsSync } from 'fs';
import { describeApiLock, lockPath, readApiLock } from './lock';
import { checkoutProblem } from './resolve-checkout';
import { listSnapshots } from './snapshot';

/** Prints profile, fingerprints, dirty flag, snapshot and lock holder of one API. Always exit 0 unless the checkout is missing. */
export const runStatusCommand = (options: {
  root: string;
  name: string;
  api: ApiDefinition;
  invocation: string;
  profile: string | undefined;
}) => {
  const { root, name, api, invocation, profile: requested } = options;
  const context = stateDirectoryOf({ root, name, api });

  if (!context.ok) {
    console.error(checkoutProblem({ failure: context, name, invocation }));

    return 1;
  }

  const { checkout, directory } = context;
  const state = readApiState(directory);
  const profileName = requested ?? state?.profile ?? undefined;
  const profile = profileName === undefined ? undefined : api.profiles?.[profileName];
  const current = profile
    ? fingerprintApi({
        root,
        name,
        repoPath: checkout.repoPath,
        migrationsDir: api.migrationsDir,
        seeds: profile.seeds,
      })
    : undefined;
  const snapshots = current === undefined ? [] : listSnapshots({ root, api: name, fingerprint: current });
  const lock = readApiLock(directory);
  const rows: [string, string][] = [
    ['profile', profileName ?? 'none'],
    ['stored', state?.fingerprint ?? 'none'],
    ['current', current ?? (profileName === undefined ? 'none' : `no profile "${profileName}"`)],
    ['dirty', state ? (state.dirty ? 'yes' : 'no') : 'unknown'],
    ['snapshot', snapshots.length > 0 ? snapshots.join(', ') : 'none for the current fingerprint'],
    [
      'lock',
      lock
        ? describeApiLock(lock, directory)
        : existsSync(lockPath(directory))
          ? `unreadable (${lockPath(directory)})`
          : 'free',
    ],
  ];
  const width = Math.max(...rows.map(([label]) => label.length));

  console.log(rows.map(([label, value]) => `  ${label.padEnd(width)}  ${value}`).join('\n'));

  return 0;
};
