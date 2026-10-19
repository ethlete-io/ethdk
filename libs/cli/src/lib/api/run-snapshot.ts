import { relative } from 'path';
import { definedEntries, stateDirectoryOf } from './api-context';
import { ApiDefinition, ApiProfile } from './definition';
import { fingerprintApi } from './fingerprint';
import { ignoredByGit } from './git';
import { acquireApiLock, describeApiLock, heldLockFromEnv, releaseApiLock } from './lock';
import { LOCK_TIMEOUT_EXIT_CODE } from './run-locked';
import { checkoutProblem } from './resolve-checkout';
import { composeToolNames, engineEnv, resolveComposeTool } from './compose';
import { SNAPSHOT_NAME, restoreSnapshot, saveSnapshot, snapshotFilePath } from './snapshot';

type Parsed<T> = { ok: true; value: T } | { ok: false; problem: string };

/** `requested`, or the one profile with a `snapshot` block. */
export const chooseSnapshotProfile = (options: {
  name: string;
  api: ApiDefinition;
  requested: string | undefined;
}): Parsed<{ profileName: string; profile: ApiProfile & { snapshot: NonNullable<ApiProfile['snapshot']> } }> => {
  const { name, api, requested } = options;
  const profiles = Object.entries(api.profiles ?? {});
  const withSnapshot = profiles.filter(([, profile]) => profile.snapshot !== undefined);

  const pick = (profileName: string, profile: ApiProfile | undefined): ReturnType<typeof chooseSnapshotProfile> => {
    if (!profile) {
      return {
        ok: false,
        problem: `The ${name} API has no profile "${profileName}". Profiles: ${profiles.map(([key]) => key).join(', ') || 'none'}`,
      };
    }

    return profile.snapshot
      ? { ok: true, value: { profileName, profile: { ...profile, snapshot: profile.snapshot } } }
      : { ok: false, problem: `The profile "${profileName}" of the ${name} API declares no snapshot.` };
  };

  if (requested !== undefined) return pick(requested, api.profiles?.[requested]);

  if (withSnapshot.length === 1) {
    const [[profileName, profile]] = withSnapshot as [[string, ApiProfile]];

    return pick(profileName, profile);
  }

  return {
    ok: false,
    problem:
      withSnapshot.length === 0
        ? `The ${name} API has no profile with a snapshot block.`
        : `The ${name} API has several profiles with a snapshot block. Choose one with --profile <name>: ${withSnapshot
            .map(([key]) => key)
            .join(', ')}`,
  };
};

export type RunSnapshotOptions = {
  root: string;
  name: string;
  api: ApiDefinition;
  invocation: string;
  action: string | undefined;
  snapshotName: string | undefined;
  profile: string | undefined;
  wait: number | undefined;
};

/** Runs `snapshot save|restore <api> <name>` and returns the exit code. */
export const runSnapshotCommand = async (options: RunSnapshotOptions): Promise<number> => {
  const { root, name, api, invocation, action, snapshotName, profile: requested, wait } = options;
  const usage = `${invocation} snapshot save|restore <api> <name> [--profile <profile>]`;

  if ((action !== 'save' && action !== 'restore') || snapshotName === undefined) {
    console.error(`snapshot needs an action and a name: ${usage}`);

    return 1;
  }

  if (!SNAPSHOT_NAME.test(snapshotName)) {
    console.error(`"${snapshotName}" is not a snapshot name. Use letters, digits, ".", "-" and "_".`);

    return 1;
  }

  const chosen = chooseSnapshotProfile({ name, api, requested });

  if (!chosen.ok) {
    console.error(chosen.problem);

    return 1;
  }

  const context = stateDirectoryOf({ root, name, api, needs: 'env' });

  if (!context.ok) {
    console.error(checkoutProblem({ failure: context, name, invocation }));

    return 1;
  }

  const tool = resolveComposeTool();

  if (!tool) {
    console.error(`No compose tool found. Tried: ${composeToolNames().join(', ')}.`);

    return 1;
  }

  const { profileName, profile } = chosen.value;
  const { checkout, directory } = context;
  const fingerprint = fingerprintApi({
    root,
    name,
    repoPath: checkout.repoPath,
    migrationsDir: api.migrationsDir,
    seeds: profile.seeds,
  });
  const file = snapshotFilePath({ root, api: name, name: snapshotName, fingerprint });
  const [binary, ...prefix] = tool.compose;
  const compose = {
    binary,
    prefix,
    cwd: checkout.composePath,
    env: { ...engineEnv(tool.engine), ...process.env, ...definedEntries(api.env?.() ?? {}) },
  };

  if (ignoredByGit(root, relative(root, file)) === false) {
    console.warn(
      `${relative(root, file)} is not gitignored, so a snapshot could be committed. ` +
        `Add "/.ethlete/snapshots/" to .gitignore.\n`,
    );
  }

  if (action === 'save') return saveSnapshot({ file, snapshot: profile.snapshot, compose });

  const state = { directory, profile: profileName, fingerprint };

  if (heldLockFromEnv(directory)) return restoreSnapshot({ file, snapshot: profile.snapshot, compose, state });

  const acquired = await acquireApiLock({
    directory,
    command: `${invocation} snapshot restore ${name} ${snapshotName}`,
    cwd: root,
    wait,
    onHeld: (holder) => console.error(`Waiting for the API lock, held by ${describeApiLock(holder, directory)}.`),
  });

  if (!acquired.ok) {
    console.error(`Gave up after ${wait} s. The API lock is held by ${describeApiLock(acquired.holder, directory)}.`);

    return LOCK_TIMEOUT_EXIT_CODE;
  }

  try {
    return await restoreSnapshot({ file, snapshot: profile.snapshot, compose, state });
  } finally {
    releaseApiLock(directory, acquired.lock.token);
  }
};
