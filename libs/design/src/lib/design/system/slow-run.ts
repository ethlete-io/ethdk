import { timedPhase } from '../phase-timing';
import { exhaustMap, from, interval } from 'rxjs';
import { openUndesignedSketches, ShootBuilt, shootBuiltState } from './sketch/undesigned-sketch';
import { relative, resolve } from 'path';
import { DesignConfig } from '../design-config';
import { noVisibleChangeProblems } from '../ready-shots';
import { createRunDraw } from '../warm-draw';
import { actionLostProblemsOf } from './action-lost';
import { stateInnerProblemsOf } from './rules/state-inner';
import { bespokeControlProblemsOf } from './bespoke-controls';
import { contrastPairProblemsOf } from './contrast-pairs';
import {
  ACTION_LOST_RULE,
  COMPARE_RULE,
  CONTRAST_PAIR_RULE,
  CONTROL_STATE_RULE,
  DROPPED_PROP_RULE,
  STATE_INNER_RULE,
  SDK_ERROR_RULE,
  APP_ERROR_RULE,
} from './build-ready-contract';
import { shootStates, ShootStates, StateShot } from './compare-command';
import { appFilesOf } from './app-files';
import { HarnessServer, startHarnessServer, StartHarnessServer } from './harness-server';
import { derivedLinksOf, writeDerivedLinks } from './derived-links';
import { liveUncoveredOf, UncoveredState } from './live-uncovered';
import { appComponentsOf } from './slot-hosts';
import { droppedPropProblemsOf, pagePropTakerOf } from './dropped-props';
import { shotCompareLinesOf, shotCompareOf } from './part-compare';
import { Problem } from './problem';
import { repoRootOf } from './reachable-files';
import { RecordSettledRequest, recordSettledBuildReady } from './record-settled';
import { withStampsInCache } from './stamp-files';
import { partKeyOf, partOfFile, ResolvedProduct, resolveProduct } from './resolve-product';
import { ruleBaselineOf } from './rule-baseline';
import { APP_SPEC_RULE, appSpecProblemsOf, RunRelatedSpecs, runRelatedSpecs, specSeedsOf } from './rules/app-spec';
import { isJudgedForVisibleChange, NO_VISIBLE_CHANGE_RULE } from './rules/no-visible-change';
import { listSketches, Sketch } from './sketch/sketch';
import { UNCOVERED_REGION_RULE, uncoveredRegionProblemsOf } from './rules/uncovered-region';
import { sdkErrorLineOf } from './sdk-errors';
import { autoAcceptOf, settleCommittedEdits } from './accepted-pictures';
import { partHashOf } from './sketch/baseline';
import { allHeldEdits, HeldEdits, holdEdit } from './sketch/held-edits';
import { changedOutsideSketchOf } from './sketch/merged-parts';
import {
  linkedComponentOf,
  PRODUCT_PART,
  readStoredSlowResults,
  isSlowRule,
  slowInputsOf,
  UnjudgedState,
  unjudgedStateWarningsOf,
  writeSlowResults,
} from './slow-checks';
import { repoInvocation } from '@ethlete/cli/src/lib/invocation';

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
  controlState: typeof bespokeControlProblemsOf;
  contrastPairs: typeof contrastPairProblemsOf;
  droppedProps: typeof droppedPropProblemsOf;
  pageProps: typeof pagePropTakerOf;
  actionLost: typeof actionLostProblemsOf;
  stateInner: typeof stateInnerProblemsOf;
  noVisibleChange: (options: {
    target: string;
    config: DesignConfig;
    product: ResolvedProduct;
    sketches: Sketch[];
  }) => Promise<Problem[]>;
};

const defaultRunners: SlowRunners = {
  specs: runRelatedSpecs,
  start: startHarnessServer,
  shoot: shootStates,
  live: async ({ target, config, product, url, pages }) => {
    const checked = await liveUncoveredOf({ target, config, product, url, pages });

    return typeof checked === 'string' ? checked : checked.states;
  },
  controlState: bespokeControlProblemsOf,
  contrastPairs: contrastPairProblemsOf,
  // Called through arrows: the CLI loads dropped-props first, and it reaches this module before its exports exist.
  droppedProps: (options) => droppedPropProblemsOf(options),
  pageProps: (options) => pagePropTakerOf(options),
  actionLost: actionLostProblemsOf,
  stateInner: stateInnerProblemsOf,
  noVisibleChange: async ({ target, config, product, sketches }) => {
    const run = createRunDraw(target);

    try {
      const problems: Problem[] = [];

      for (const sketch of sketches)
        problems.push(...(await noVisibleChangeProblems({ target, config, product, sketch, warm: run.warm })));

      return problems;
    } catch (error) {
      return sketches.map((sketch) => ({
        rule: NO_VISIBLE_CHANGE_RULE,
        file: relative(repoRootOf(product), sketch.dir),
        part: sketch.target,
        message: `the shots failed: ${error instanceof Error ? error.message : String(error)}`,
      }));
    } finally {
      await run.close();
    }
  },
};

const merge = (into: Map<string, Problem[]>, from: Map<string, Problem[]>) => {
  for (const [part, problems] of from) into.set(part, [...(into.get(part) ?? []), ...problems]);
};

/** @internal The compare problems of a part: one per failing state, or per failing box of a state compared by its boxes. */
export const comparedProblemsOf = async (options: {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  part: string;
  file: string;
  url: string;
  shoot: ShootStates;
  designOnly?: boolean;
  panesOnly?: boolean;
  component?: string | null;
}): Promise<Problem[]> => {
  const shot = await options.shoot({ ...options, only: null });
  const problemOf = (text: string): Problem => ({
    rule: sdkErrorLineOf(text) ? SDK_ERROR_RULE : COMPARE_RULE,
    file: options.file,
    message: text,
  });

  if (typeof shot === 'string') return [problemOf(shot)];

  const appErrorOf = (state: StateShot): Problem[] =>
    'problem' in state && state.appError
      ? [{ rule: APP_ERROR_RULE, file: options.file, message: `${options.part} ${state.state}: ${state.problem}` }]
      : [];

  if (options.designOnly || options.panesOnly)
    return shot.shots.flatMap((state): Problem[] => {
      if (!('problem' in state)) return [];
      if (state.appError) return appErrorOf(state);
      if (state.missingPanes) return [problemOf(`${state.state}: ${state.problem}`)];

      return options.designOnly && state.undrivable
        ? [
            problemOf(
              `${state.state}: ${state.problem} - the design changed and the app cannot drive this state; build its trigger in ${options.component ?? 'the app component'}`,
            ),
          ]
        : [];
    });

  return shot.shots.flatMap((state): Problem[] => {
    if ('problem' in state) return state.appError ? appErrorOf(state) : [problemOf(`${state.state}: ${state.problem}`)];

    const compared = shotCompareOf(state);

    return compared.ok ? [] : shotCompareLinesOf(state.state, compared).map(problemOf);
  });
};

/**
 * Runs the slow rules - the draw rules, then `UNCOVERED-REGION`, compare and the SDK-error watch against one
 * harness app, then `APP-SPEC` - on the product's parts that have one, or on `parts`, one browser at a time, and
 * stores each part's problems at the inputs it had when the run started.
 */
export const runSlowChecks = async (options: {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  parts?: string[];
  runners?: Partial<SlowRunners>;
}): Promise<Map<string, Problem[]>> => {
  const { target, config, product } = options;
  const runners = { ...defaultRunners, ...options.runners };
  const root = repoRootOf(product);
  const inputs = Object.fromEntries(
    Object.entries(timedPhase('slow inputs', () => slowInputsOf({ product, only: options.parts }))).filter(
      ([part]) => !options.parts || options.parts.includes(part),
    ),
  );
  const keys = Object.keys(inputs).filter((part) => part !== PRODUCT_PART);
  const whole = !options.parts;
  const ruled = (rule: string) => keys.filter((part) => inputs[part]?.rules.includes(rule));
  const results = new Map<string, Problem[]>();
  const unjudged = new Map<string, UnjudgedState[]>();
  const harness = product.config.harness;
  const shoot: ShootStates = async (asked) => {
    const shot = await runners.shoot(asked);

    if (typeof shot !== 'string') {
      const known = unjudged.get(asked.part) ?? [];

      for (const state of shot.shots)
        if ('problem' in state && !known.some((seen) => seen.state === state.state))
          known.push({ state: state.state, why: state.problem });

      if (known.length > 0) unjudged.set(asked.part, known);
    }

    return shot;
  };
  const fileOf = (part: string) => {
    const found = product.parts.find((candidate) => partKeyOf(candidate) === part);

    return found ? relative(root, found.file) : part;
  };

  const componentOf = (part: string) => {
    const found = product.parts.find((candidate) => partKeyOf(candidate) === part);

    return found ? linkedComponentOf(found) : null;
  };

  const byPart = (problems: Problem[]) =>
    new Map(
      [...new Set(problems.map((problem) => partOfFile(product, problem.file)))].map((part) => [
        part,
        problems
          .filter((problem) => partOfFile(product, problem.file) === part)
          .map((problem) => ({ ...problem, file: relative(root, problem.file) })),
      ]),
    );

  if (ruled(CONTROL_STATE_RULE).length > 0)
    merge(
      results,
      byPart(
        await timedPhase('slow control-state', () =>
          runners.controlState({ target, config, product, parts: ruled(CONTROL_STATE_RULE) }),
        ),
      ),
    );

  if (ruled(CONTRAST_PAIR_RULE).length > 0)
    merge(
      results,
      byPart(
        await timedPhase('slow contrast-pairs', () =>
          runners.contrastPairs({ target, config, product, parts: ruled(CONTRAST_PAIR_RULE) }),
        ),
      ),
    );

  if (ruled(DROPPED_PROP_RULE).length > 0)
    merge(
      results,
      byPart(
        await timedPhase('slow dropped-props', () =>
          runners.droppedProps({ target, config, product, parts: ruled(DROPPED_PROP_RULE) }),
        ),
      ),
    );

  if (ruled(STATE_INNER_RULE).length > 0)
    merge(
      results,
      byPart(
        await timedPhase('slow state-inner', () =>
          runners.stateInner({ target, config, product, parts: ruled(STATE_INNER_RULE) }),
        ),
      ),
    );

  if (ruled(NO_VISIBLE_CHANGE_RULE).length > 0) {
    const judged = listSketches({ productDir: product.dir, product: product.name }).flatMap((sketch) =>
      typeof sketch !== 'string' &&
      ruled(NO_VISIBLE_CHANGE_RULE).includes(sketch.target) &&
      isJudgedForVisibleChange({ product, sketch })
        ? [sketch]
        : [],
    );

    for (const problem of await timedPhase('slow no-visible-change', () =>
      runners.noVisibleChange({ target, config, product, sketches: judged }),
    ))
      results.set(problem.part ?? PRODUCT_PART, [...(results.get(problem.part ?? PRODUCT_PART) ?? []), problem]);
  }

  if (inputs[PRODUCT_PART]?.rules.includes(ACTION_LOST_RULE)) {
    const lost = await timedPhase('slow action-lost', () =>
      runners.actionLost({
        target,
        config,
        product,
        invocation: repoInvocation({ root: target, subcommand: 'design' }),
      }),
    );

    merge(
      results,
      new Map([[PRODUCT_PART, lost.map((problem) => ({ ...problem, file: relative(root, problem.file) }))]]),
    );
  }

  if (harness && keys.length + (whole ? 1 : 0) > 0) {
    const specsConfig = ruled(APP_SPEC_RULE).length > 0 || whole ? harness.specs : undefined;
    const runSpecs = specsConfig
      ? () => {
          const parts = ruled(APP_SPEC_RULE).map((part) => {
            const found = product.parts.find((candidate) => partKeyOf(candidate) === part);
            const component = found ? linkedComponentOf(found) : null;

            return { part, files: component === null ? [] : Object.keys(appFilesOf({ root, component })) };
          });

          return runners
            .specs({
              root,
              config: specsConfig,
              files: whole
                ? [harness.app]
                : specSeedsOf({
                    root,
                    files: parts.flatMap(({ files }) => files),
                    shared: harness.shared ?? [],
                  }),
            })
            .then((failures) => {
              if (typeof failures === 'string')
                results.set(PRODUCT_PART, [{ rule: APP_SPEC_RULE, file: specsConfig, message: failures }]);
              else merge(results, appSpecProblemsOf({ parts, failures }));
            });
        }
      : undefined;
    const harnessResults = new Map<string, Problem[]>();
    const server: HarnessServer | string = await timedPhase('slow harness-start', () =>
      runners.start({ target, product }),
    );

    if (typeof server === 'string') {
      merge(
        harnessResults,
        new Map([
          [
            PRODUCT_PART,
            [
              {
                rule: COMPARE_RULE,
                file: harness.map,
                message: `the harness app did not start: ${server}`,
              },
            ],
          ],
        ]),
      );
    } else {
      try {
        if (harness.live && (ruled(UNCOVERED_REGION_RULE).length > 0 || whole)) {
          const states = await timedPhase('slow live', () =>
            runners.live({
              target,
              config,
              product,
              url: server.url,
              pages: whole ? undefined : ruled(UNCOVERED_REGION_RULE),
            }),
          );

          merge(
            harnessResults,
            typeof states === 'string'
              ? new Map([[PRODUCT_PART, [{ rule: UNCOVERED_REGION_RULE, file: harness.live, message: states }]]])
              : uncoveredRegionProblemsOf({ product, live: harness.live, states }),
          );

          if (typeof states !== 'string') {
            const derived = derivedLinksOf({
              product,
              states,
              components: appComponentsOf({ target, product }),
              takes: states.some((state) => 'around' in state)
                ? await runners.pageProps({ target, config, product })
                : undefined,
            });

            writeDerivedLinks({ target, product, derived }).forEach((line) => console.log(line));
          }
        }

        for (const part of ruled(COMPARE_RULE)) {
          const problems = await timedPhase('slow compare', () =>
            comparedProblemsOf({
              target,
              config,
              product,
              part,
              file: fileOf(part),
              url: server.url,
              shoot,
              designOnly: inputs[part]?.designOnly === true,
              panesOnly: inputs[part]?.panesOnly === true,
              component: componentOf(part),
            }),
          );

          if (problems.length > 0) merge(harnessResults, new Map([[part, problems]]));
        }
      } finally {
        await server.stop();
      }
    }

    if (runSpecs) await timedPhase('slow specs', runSpecs);
    merge(results, harnessResults);
  }

  if (!whole) results.delete(PRODUCT_PART);

  writeSlowResults({
    product,
    hashes: Object.fromEntries(Object.entries(inputs).map(([part, { hash }]) => [part, hash])),
    results,
    unjudged,
  });

  return results;
};

/** `--slow` of the check command: runs the slow rules on each product, or on `parts`, and prints each problem. */
export const checkSlow = async (options: {
  target: string;
  config: DesignConfig;
  products: string[];
  parts: string[] | undefined;
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
    const found = [...results.entries()].flatMap(([part, problems]) => problems.map((problem) => ({ part, problem })));
    const baselined = ruleBaselineOf({
      product,
      problems: found.map(({ problem }) => problem),
      checked: (rule, part) => isSlowRule(rule) && (!options.parts || options.parts.includes(part)),
    });

    baselined.lines.forEach((line) => console.log(line));
    unjudgedStateWarningsOf({ product, parts: options.parts ?? product.parts.map((part) => partKeyOf(part)) }).forEach(
      (line) => console.warn(line),
    );

    for (const problem of baselined.problems) {
      const part = found.find((hit) => hit.problem === problem)?.part ?? partOfFile(product, problem.file);

      console.log(
        `${name} ${part}: ${problem.rule} ${relative(options.target, resolve(options.target, problem.file))}: ${problem.message}`,
      );
    }

    failed += baselined.problems.length;
  }

  const seconds = Math.round((Date.now() - started) / 1000);

  console.log(failed === 0 ? `No slow-rule problem (${seconds}s).` : `${failed} slow-rule problem(s) (${seconds}s).`);

  return failed === 0 ? 0 : 1;
};

const SLOW_POLL_MS = 15_000;

const settledEditsOf = ({
  product,
  seen,
  resolved,
}: {
  product: ResolvedProduct;
  seen: Map<string, string>;
  resolved: Map<string, string>;
}) =>
  changedOutsideSketchOf(product).filter((part) => {
    const key = `edit\0${product.name}\0${part}`;
    const hash = partHashOf({ product, dir: resolve(product.dir, part) });
    const settled = seen.get(key) === hash && resolved.get(key) !== hash;

    seen.set(key, hash);
    if (settled) resolved.set(key, hash);

    return settled;
  });

/**
 * Keeps the slow results of every harness product fresh while the design server runs: each poll reruns the parts whose
 * inputs changed and then held still for one poll, one run at a time. Before them it settles each direct edit HEAD
 * already holds, and resolves each other direct edit of a merged part that held still for one poll: it holds, or it
 * opens the old/new edit sketch. It writes neither `merged.json` nor any other file git tracks for them: the server keeps
 * a held or settled edit in memory and shows it as no open point. After a run it writes or drops the check record of each
 * run part and its hosts in the stamp cache (`withStampsInCache`), never in the tracked `ready.json`.
 */
export const startSlowRunner = (options: {
  target: string;
  configOf: () => DesignConfig | null;
  log: (line: string) => void;
  intervalMs?: number;
  runners?: Partial<SlowRunners>;
  record?: (request: RecordSettledRequest) => Promise<void>;
  onHeld?: (held: HeldEdits) => void;
  shootBuilt?: ShootBuilt;
}) => {
  const record = options.record ?? recordSettledBuildReady;
  const seen = new Map<string, string>();
  const resolvedEdits = new Map<string, string>();
  let running = false;

  const poll = async () => {
    if (running) return;

    running = true;

    try {
      const config = options.configOf() ?? {};

      for (const [name, entry] of Object.entries(config.products ?? {})) {
        const edited = resolveProduct({ target: options.target, name, config: entry });

        const settled: { part: string; hash: string }[] = [];

        settleCommittedEdits({ target: options.target, product: edited, writesTracked: false, held: settled });
        settled.forEach(({ part, hash }) => holdEdit({ product: edited, part, hash }));
        if (settled.length > 0) options.onHeld?.(allHeldEdits());

        const edits = settledEditsOf({ product: edited, seen, resolved: resolvedEdits });

        if (edits.length > 0) {
          const held: { part: string; hash: string }[] = [];

          (
            await autoAcceptOf({
              target: options.target,
              config,
              product: edited,
              parts: edits,
              writesTracked: false,
              held,
            })
          ).forEach(options.log);
          held.forEach(({ part, hash }) => holdEdit({ product: edited, part, hash }));
          if (held.length > 0) options.onHeld?.(allHeldEdits());
        }
      }

      for (const [name, entry] of Object.entries(config.products ?? {})) {
        if (!entry.harness) continue;

        const product = resolveProduct({ target: options.target, name, config: entry });
        const cache = readStoredSlowResults(product);
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
          ...(options.runners ? { runners: options.runners } : {}),
        });
        const count = [...results.values()].reduce((sum, problems) => sum + problems.length, 0);

        options.log(`slow checks: ${name} done, ${count} problem(s)`);
        await openUndesignedSketches({
          target: options.target,
          product,
          problems: [...results.values()].flat(),
          shoot: options.shootBuilt ?? shootBuiltState,
          log: options.log,
        });
        await withStampsInCache(() => record({ target: options.target, config, product, settled }));
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
