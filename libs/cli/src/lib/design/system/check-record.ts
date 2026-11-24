import { DesignConfig } from '../design-config';
import { timedPhase } from '../phase-timing';
import { BuildReady } from './build-ready-contract';
import { recordBuildReady } from './part-build-ready';
import { readyMarkOf } from './part-ready';
import { ResolvedProduct } from './resolve-product';
import { slowProblemsOf } from './slow-checks';
import { runSlowChecks, SlowRunners } from './slow-run';

/**
 * Runs `recordBuildReady` as `design check` does, after running the slow rules on each of `settle` whose slow result
 * is pending in a product with a harness, so the record step decides those parts instead of leaving them pending.
 */
export const recordCheckedBuildReady = async (
  options: Omit<Parameters<typeof recordBuildReady>[0], 'by' | 'cmd'> & {
    target: string;
    config: DesignConfig;
    settle: string[];
    runners?: Partial<SlowRunners>;
  },
) => {
  const { target, config, product, settle, runners, ...record } = options;

  if (product.config.harness)
    await timedPhase('open-points settle-slow', () =>
      settlePendingSlowOf({ target, config, product, parts: settle, runners }),
    );

  return timedPhase('open-points record', () =>
    recordBuildReady({ product, by: 'et design check', cmd: 'check', ...record }),
  );
};

/** The failed actions of each recorded part the check left without a holding record. */
export const actionFailuresOf = (options: { product: ResolvedProduct; recorded: Map<string, BuildReady> }) =>
  [...options.recorded].flatMap(([part, verdict]) => {
    const failures = verdict.ready
      ? []
      : verdict.blockers.filter((blocker) => blocker.kind === 'action').map((blocker) => blocker.text);

    return failures.length > 0 && readyMarkOf({ product: options.product, part }) === null ? [{ part, failures }] : [];
  });

/** The line `design check` prints when parts of a product still wait for their slow rules, naming the commands that settle them. */
export const slowWaitingLineOf = (options: { product: string; count: number }) =>
  `PENDING ${options.product}: ${options.count} ${options.count === 1 ? 'part waits' : 'parts wait'} for slow rules - run design serve or design check --product ${options.product} --part <part>`;

const settlePendingSlowOf = async (options: {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  parts: string[];
  runners: Partial<SlowRunners> | undefined;
}) => {
  const { target, config, product, runners } = options;
  const pending = timedPhase('slow pending', () =>
    options.parts.filter((part) => slowProblemsOf({ product, part }) === 'pending'),
  );

  if (pending.length > 0)
    await runSlowChecks({ target, config, product, parts: pending, ...(runners ? { runners } : {}) });
};
