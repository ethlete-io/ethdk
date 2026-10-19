import { existsSync } from 'fs';
import { setTimeout as delay } from 'timers/promises';
import { definedEntries, stateDirectoryOf } from './api-context';
import { markApiStateDirty, readApiState, writeApiState } from './api-state';
import { composeToolNames, engineEnv, resolveComposeTool } from './compose';
import { ApiDefinition, ApiProfile } from './definition';
import { runDoctor } from './doctor';
import { fingerprintApi } from './fingerprint';
import { LockSystem, acquireApiLock, describeApiLock, heldLockFromEnv, releaseApiLock } from './lock';
import { checkoutProblem } from './resolve-checkout';
import { LOCK_TIMEOUT_EXIT_CODE } from './run-locked';
import { warnUnlessSnapshotIgnored } from './run-snapshot';
import { SeedStep, readSeedManifest, seedSteps } from './seeds';
import { didYouMean } from './suggest';
import { restoreSnapshot, saveSnapshot, snapshotFilePath } from './snapshot';

type Parsed<T> = { ok: true; value: T } | { ok: false; problem: string };

/** One run of the seed machinery: manifest steps copied and run together, or one `exec` entry of the API. */
export type ReadySeedUnit = { kind: 'steps'; steps: SeedStep[] } | { kind: 'exec'; name: string };

export const HEALTH_TIMEOUT_MS = 60_000;
export const HEALTH_RETRY_MS = 2_000;

const has = (record: object, key: string) => Object.prototype.hasOwnProperty.call(record, key);

/** Each name is `fixtures`, a seed of `.ethlete/seeds/<api>/seeds.json`, or an `exec` entry, checked in that order. */
export const resolveProfileSeeds = (options: {
  root: string;
  name: string;
  api: ApiDefinition;
  profileName: string;
  seeds: readonly string[];
}): Parsed<ReadySeedUnit[]> => {
  const { root, name, api, profileName, seeds } = options;
  const manifest = readSeedManifest(root, name);
  const units: ReadySeedUnit[] = [];

  for (const seed of seeds) {
    const fromManifest =
      manifest.ok && (seed === 'fixtures' ? manifest.value.fixtures !== undefined : has(manifest.value.seeds, seed))
        ? seedSteps({
            manifest: manifest.value,
            names: seed === 'fixtures' ? [] : [seed],
            withFixtures: seed === 'fixtures',
            api: name,
          })
        : undefined;

    if (fromManifest?.ok) {
      const last = units[units.length - 1];

      if (last?.kind === 'steps') last.steps.push(...fromManifest.value);
      else units.push({ kind: 'steps', steps: [...fromManifest.value] });

      continue;
    }

    if (api.exec?.[seed] !== undefined) {
      units.push({ kind: 'exec', name: seed });

      continue;
    }

    const candidates = [
      ...(manifest.ok && manifest.value.fixtures ? ['fixtures'] : []),
      ...(manifest.ok ? Object.keys(manifest.value.seeds) : []),
      ...Object.keys(api.exec ?? {}),
    ];

    return {
      ok: false,
      problem:
        `The ${profileName} profile of the ${name} API names "${seed}", which is no seed, fixtures list or exec entry.` +
        `${didYouMean(seed, candidates)}\n\nKnown: ${candidates.length > 0 ? candidates.join(', ') : 'none'}` +
        (manifest.ok ? '' : `\n\n${manifest.problem}`),
    };
  }

  return { ok: true, value: units };
};

/** GETs `url` until it answers `expect`, every `retryMs` for up to `timeoutMs`. */
export const waitForHealth = async (options: {
  url: string;
  expect: number;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  timeoutMs?: number;
  retryMs?: number;
}): Promise<{ ok: true } | { ok: false; last: string }> => {
  const {
    url,
    expect,
    fetch: get = fetch,
    sleep = async (ms) => void (await delay(ms)),
    now = Date.now,
    timeoutMs = HEALTH_TIMEOUT_MS,
    retryMs = HEALTH_RETRY_MS,
  } = options;
  const startedAt = now();

  for (;;) {
    let last: string;

    try {
      const left = Math.max(1, timeoutMs - (now() - startedAt));
      const response = await get(url, { signal: AbortSignal.timeout(Math.min(retryMs * 5, left)) });

      if (response.status === expect) return { ok: true };

      last = `status ${response.status}`;
    } catch (error) {
      last = (error as Error).message;
    }

    if (now() - startedAt >= timeoutMs) return { ok: false, last };

    await sleep(retryMs);
  }
};

export type RunReadyOptions = {
  root: string;
  name: string;
  api: ApiDefinition;
  invocation: string;
  profile: string | undefined;
  wait: number | undefined;
  up: () => Promise<number>;
  runSeeds: (unit: ReadySeedUnit) => Promise<number>;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  lockSystem?: LockSystem;
};

const step = (text: string) => console.error(`\n==> ${text}`);

/** Runs `ready <api> --profile <p>` and returns the exit code. */
export const runReadyCommand = async (options: RunReadyOptions): Promise<number> => {
  const { root, name, api, invocation, profile: profileName, wait, now = Date.now } = options;
  const startedAt = now();
  const profileNames = Object.keys(api.profiles ?? {});
  const profile: ApiProfile | undefined = profileName === undefined ? undefined : api.profiles?.[profileName];

  if (profileName === undefined || profile === undefined) {
    console.error(
      (profileName === undefined
        ? `ready needs a profile: ${invocation} ready ${name} --profile <profile>.`
        : `The ${name} API has no profile "${profileName}".${didYouMean(profileName, profileNames)}`) +
        `\n\nProfiles: ${profileNames.length > 0 ? profileNames.join(', ') : 'none'}`,
    );

    return 1;
  }

  const units = resolveProfileSeeds({ root, name, api, profileName, seeds: profile.seeds });

  if (!units.ok) {
    console.error(units.problem);

    return 1;
  }

  const context = stateDirectoryOf({ root, name, api });

  if (!context.ok) {
    console.error(checkoutProblem({ failure: context, name, invocation }));

    return 1;
  }

  const tool = resolveComposeTool();

  if (!tool) {
    console.error(`No compose tool found. Tried: ${composeToolNames().join(', ')}.`);

    return 1;
  }

  const { checkout, directory } = context;
  const env = { ...engineEnv(tool.engine), ...process.env, ...definedEntries(api.env?.() ?? {}) };
  let token: string | undefined;

  if (heldLockFromEnv(directory)) {
    step('Using the API lock this command runs under');
  } else {
    step('Taking the API lock');

    const acquired = await acquireApiLock({
      directory,
      command: `${invocation} ready ${name} --profile ${profileName}`,
      cwd: root,
      wait,
      system: options.lockSystem,
      onHeld: (holder) => console.error(`Waiting for the API lock, held by ${describeApiLock(holder, directory)}.`),
    });

    if (!acquired.ok) {
      console.error(`Gave up after ${wait} s. The API lock is held by ${describeApiLock(acquired.holder, directory)}.`);

      return LOCK_TIMEOUT_EXIT_CODE;
    }

    token = acquired.lock.token;
  }

  try {
    step(`Starting ${name}`);

    const upCode = await options.up();

    if (upCode !== 0) return upCode;

    step('Checking the API (doctor --fix)');

    if (!runDoctor({ name, api, tool, cwd: checkout.composePath, env, invocation, fix: true }).ok) return 1;

    const fingerprint = fingerprintApi({
      root,
      name,
      repoPath: checkout.repoPath,
      migrationsDir: api.migrationsDir,
      seeds: profile.seeds,
    });
    const state = readApiState(directory);
    const [binary, ...prefix] = tool.compose;
    const compose = { binary, prefix, cwd: checkout.composePath, env };
    const file = snapshotFilePath({ root, api: name, name: profileName, fingerprint });

    if (state && !state.dirty && state.profile === profileName && state.fingerprint === fingerprint) {
      step(`Already ready: ${profileName} at ${fingerprint}`);
    } else if (profile.snapshot && existsSync(file)) {
      step(`Restoring the ${profileName} snapshot ${fingerprint}`);

      const restored = await restoreSnapshot({
        file,
        snapshot: profile.snapshot,
        compose,
        state: { directory, profile: profileName, fingerprint },
      });

      if (restored !== 0) return restored;
    } else {
      markApiStateDirty(directory);

      for (const unit of units.value) {
        step(`Seeding ${unit.kind === 'exec' ? unit.name : unit.steps.map(({ label }) => label).join(', ')}`);

        const seeded = await options.runSeeds(unit);

        if (seeded !== 0) return seeded;
      }

      if (profile.snapshot) {
        step(`Saving the ${profileName} snapshot ${fingerprint}`);
        warnUnlessSnapshotIgnored(root, file);

        const saved = await saveSnapshot({ file, snapshot: profile.snapshot, compose });

        if (saved !== 0) return saved;
      }

      writeApiState({ directory, state: { profile: profileName, fingerprint, dirty: false } });
    }

    if (profile.health) {
      const expect = profile.health.expect ?? 200;

      step(`Waiting for ${profile.health.url} to answer ${expect}`);

      const health = await waitForHealth({
        url: profile.health.url,
        expect,
        fetch: options.fetch,
        sleep: options.sleep,
        now,
      });

      if (!health.ok) {
        console.error(
          `${profile.health.url} did not answer ${expect} within ${HEALTH_TIMEOUT_MS / 1000} s. Last: ${health.last}.`,
        );

        return 1;
      }
    }

    console.log(
      `${name} is ready: profile ${profileName}, fingerprint ${fingerprint}, in ${((now() - startedAt) / 1000).toFixed(1)} s.`,
    );

    return 0;
  } finally {
    if (token !== undefined) releaseApiLock(directory, token);
  }
};
