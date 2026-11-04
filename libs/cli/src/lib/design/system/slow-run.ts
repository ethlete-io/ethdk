import { exhaustMap, from, interval } from 'rxjs';
import { relative } from 'path';
import { DesignConfig } from '../paths';
import { COMPARE_RULE, SDK_ERROR_RULE } from './build-ready-contract';
import { shootStates, ShootStates } from './compare-command';
import { appFilesOf } from './app-files';
import { HarnessServer, startHarnessServer, StartHarnessServer } from './harness-server';
import { liveUncoveredOf, UncoveredState } from './live-uncovered';
import { compareLineOf, comparePngs } from './part-compare';
import { Problem } from './problem';
import { repoRootOf } from './reachable-files';
import { partKeyOf, ResolvedProduct, resolveProduct } from './resolve-product';
import { APP_SPEC_RULE, appSpecProblemsOf, RunRelatedSpecs, runRelatedSpecs } from './rules/app-spec';
import { UNCOVERED_REGION_RULE, uncoveredRegionProblemsOf } from './rules/uncovered-region';
import { VISIBLE_CHANGE_RULE, visibleChangeProblemsOf } from './rules/visible-change';
import { sdkErrorLineOf } from './sdk-errors';
import { linkedComponentOf, PRODUCT_PART, readSlowCache, slowInputsOf, writeSlowResults } from './slow-checks';

/** What a slow run calls out to; tests swap these for fakes. */
export type SlowRunners = {
  specs: RunRelatedSpecs;
  start: StartHarnessServer;
  shoot: ShootStates;
  live: (options: {
    target: string;
    config: DesignConfig;
    product: ResolvedProduct;
    url: string;
    pages: string[] | undefined;
  }) => Promise<UncoveredState[] | string>;
  visibleChange: typeof visibleChangeProblemsOf;
};

const defaultRunners: SlowRunners = {
  specs: runRelatedSpecs,
  start: startHarnessServer,
  shoot: shootStates,
  live: async ({ target, config, product, url, pages }) => {
    const checked = await liveUncoveredOf({ target, config, product, url, pages });

    return typeof checked === 'string' ? checked : checked.states;
  },
  visibleChange: visibleChangeProblemsOf,
};

const merge = (into: Map<string, Problem[]>, from: Map<string, Problem[]>) => {
  for (const [part, problems] of from) into.set(part, [...(into.get(part) ?? []), ...problems]);
};

const comparedProblemsOf = async (options: {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  part: string;
  file: string;
  url: string;
  shoot: ShootStates;
}): Promise<Problem[]> => {
  const shot = await options.shoot({ ...options, only: null });
  const problemOf = (text: string): Problem => ({
    rule: sdkErrorLineOf(text) ? SDK_ERROR_RULE : COMPARE_RULE,
    file: options.file,
    message: text,
  });

  if (typeof shot === 'string') return [problemOf(shot)];

  return shot.shots.flatMap((state): Problem[] => {
    if ('problem' in state) return [problemOf(`${state.state}: ${state.problem}`)];

    const result = comparePngs({ design: state.design, app: state.app });

    return result.kind === 'ok' ? [] : [problemOf(compareLineOf(state.state, result))];
  });
};

/**
 * Runs the slow rules - `APP-SPEC`, `UNCOVERED-REGION`, `VISIBLE-CHANGE`, compare and the SDK-error watch - on the
 * product's parts that have one, or on `parts`, against one harness app, one browser at a time, and stores each
 * part's problems at the inputs it had when the run started.
 */
export const runSlowChecks = async (options: {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  parts?: string[];
  base?: string;
  runners?: Partial<SlowRunners>;
}): Promise<Map<string, Problem[]>> => {
  const { target, config, product } = options;
  const runners = { ...defaultRunners, ...options.runners };
  const root = repoRootOf(product);
  const inputs = Object.fromEntries(
    Object.entries(slowInputsOf({ product, base: options.base })).filter(
      ([part]) => !options.parts || options.parts.includes(part),
    ),
  );
  const keys = Object.keys(inputs).filter((part) => part !== PRODUCT_PART);
  const whole = !options.parts;
  const ruled = (rule: string) => keys.filter((part) => inputs[part]?.rules.includes(rule));
  const results = new Map<string, Problem[]>();
  const harness = product.config.harness;
  const fileOf = (part: string) => {
    const found = product.parts.find((candidate) => partKeyOf(candidate) === part);

    return found ? relative(root, found.file) : part;
  };

  if (!harness || keys.length + (whole ? 1 : 0) === 0) return results;

  if (harness.specs && (ruled(APP_SPEC_RULE).length > 0 || whole)) {
    const parts = ruled(APP_SPEC_RULE).map((part) => {
      const found = product.parts.find((candidate) => partKeyOf(candidate) === part);
      const component = found ? linkedComponentOf(found) : null;

      return { part, files: component === null ? [] : Object.keys(appFilesOf({ root, component })) };
    });
    const failures = await runners.specs({
      root,
      config: harness.specs,
      files: whole ? [harness.app] : [...new Set(parts.flatMap(({ files }) => files))],
    });

    if (typeof failures === 'string')
      results.set(PRODUCT_PART, [{ rule: APP_SPEC_RULE, file: harness.specs, message: failures }]);
    else merge(results, appSpecProblemsOf({ parts, failures }));
  }

  const server: HarnessServer | string = await runners.start({ target, product });

  if (typeof server === 'string') {
    merge(
      results,
      new Map([
        [
          PRODUCT_PART,
          [{ rule: VISIBLE_CHANGE_RULE, file: harness.map, message: `the harness app did not start: ${server}` }],
        ],
      ]),
    );
  } else {
    try {
      if (harness.live && (ruled(UNCOVERED_REGION_RULE).length > 0 || whole)) {
        const states = await runners.live({
          target,
          config,
          product,
          url: server.url,
          pages: whole ? undefined : ruled(UNCOVERED_REGION_RULE),
        });

        merge(
          results,
          typeof states === 'string'
            ? new Map([[PRODUCT_PART, [{ rule: UNCOVERED_REGION_RULE, file: harness.live, message: states }]]])
            : uncoveredRegionProblemsOf({ product, live: harness.live, states }),
        );
      }

      for (const part of ruled(COMPARE_RULE)) {
        const problems = await comparedProblemsOf({
          target,
          config,
          product,
          part,
          file: fileOf(part),
          url: server.url,
          shoot: runners.shoot,
        });

        if (problems.length > 0) results.set(part, [...(results.get(part) ?? []), ...problems]);
      }

      if (ruled(VISIBLE_CHANGE_RULE).length > 0)
        merge(
          results,
          await runners.visibleChange({
            target,
            config,
            product: product.name,
            harnessMap: harness.map,
            base: options.base,
            parts: ruled(VISIBLE_CHANGE_RULE),
            shoot: runners.shoot,
            start: (asked) =>
              asked.target === target
                ? Promise.resolve({ url: server.url, stop: async () => undefined })
                : runners.start(asked),
          }),
        );
    } finally {
      await server.stop();
    }
  }

  if (!whole) results.delete(PRODUCT_PART);

  writeSlowResults({
    product,
    hashes: Object.fromEntries(Object.entries(inputs).map(([part, { hash }]) => [part, hash])),
    results,
  });

  return results;
};

/** `--slow` of the check command: runs the slow rules on each product, or on `parts`, and prints each problem. */
export const checkSlow = async (options: {
  target: string;
  config: DesignConfig;
  products: string[];
  parts: string[] | undefined;
  base: string | undefined;
}): Promise<number> => {
  const started = Date.now();
  let failed = 0;

  for (const name of options.products) {
    const entry = options.config.products?.[name];

    if (!entry) {
      console.log(`NO PRODUCT "${name}" in config.json.`);
      failed++;
      continue;
    }

    const product = resolveProduct({ target: options.target, name, config: entry });
    const results = await runSlowChecks({ ...options, product });

    for (const [part, problems] of results)
      for (const problem of problems)
        console.log(`${name} ${part}: ${problem.rule} ${problem.file}: ${problem.message}`);

    failed += [...results.values()].reduce((sum, problems) => sum + problems.length, 0);
  }

  const seconds = Math.round((Date.now() - started) / 1000);

  console.log(failed === 0 ? `No slow-rule problem (${seconds}s).` : `${failed} slow-rule problem(s) (${seconds}s).`);

  return failed === 0 ? 0 : 1;
};

const SLOW_POLL_MS = 15_000;

/**
 * Keeps the slow results of every harness product fresh while the design server runs: each poll reruns the parts whose
 * inputs changed and then held still for one poll, one run at a time.
 */
export const startSlowRunner = (options: {
  target: string;
  configOf: () => DesignConfig | null;
  log: (line: string) => void;
  intervalMs?: number;
}) => {
  const seen = new Map<string, string>();
  let running = false;

  const poll = async () => {
    if (running) return;

    running = true;

    try {
      const config = options.configOf() ?? {};

      for (const [name, entry] of Object.entries(config.products ?? {})) {
        if (!entry.harness) continue;

        const product = resolveProduct({ target: options.target, name, config: entry });
        const cache = readSlowCache(product);
        const stale = Object.entries(slowInputsOf({ product })).filter(
          ([part, { hash }]) => cache[part]?.hash !== hash,
        );
        const settled = stale.filter(([part, { hash }]) => seen.get(`${name}\0${part}`) === hash).map(([part]) => part);

        for (const [part, { hash }] of stale) seen.set(`${name}\0${part}`, hash);

        if (settled.length === 0) continue;

        options.log(`slow checks: ${name} ${settled.join(', ')}`);

        const results = await runSlowChecks({
          target: options.target,
          config,
          product,
          parts: settled.includes(PRODUCT_PART) ? undefined : settled,
        });
        const count = [...results.values()].reduce((sum, problems) => sum + problems.length, 0);

        options.log(`slow checks: ${name} done, ${count} problem(s)`);
      }
    } catch (error) {
      options.log(`slow checks failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      running = false;
    }
  };

  const polls = interval(options.intervalMs ?? SLOW_POLL_MS)
    .pipe(exhaustMap(() => from(poll())))
    .subscribe();

  return { poll, stop: () => polls.unsubscribe() };
};
