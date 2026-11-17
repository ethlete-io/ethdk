import { declaredPartActionsOf } from './action-lost';
import { settleCommittedEdits } from './accepted-pictures';
import { PART_HARNESS_ONLY, partActionFailuresOf } from './actions-command';
import { refreshHarnessMap } from './harness-map';
import { openPointsText } from './open-points';
import { DesignConfig } from '../design-config';
import { buildReadyInputsOf } from './check-system';
import { drawnFindingsOf } from './drawn-open-points';
import { markPartReady, readyPartOf } from './part-ready';
import { partPointsOf, readOpenPoints } from './read-open-points';
import { RenderIssue } from './render-check';
import { renderFindingsOf, withFoundRules } from './render-findings';
import { checkBlockersOf } from './part-build-ready';
import { partKeyOf, ResolvedProduct } from './resolve-product';
import { runSlowChecks } from './slow-run';
import { slowProblemsOf } from './slow-checks';
import { originOf } from './write-origin';
import { staleDistWarningsOf } from './stale-dist';
import { argsOf, authorOf, configOf, oneProductOf } from './sketch/cli-args';
import { parseTarget } from './sketch/sketch';

export const READY_USAGE =
  'ready <layer>/<name> --product <name> [--url <app dev server url>] --by <model id | designer>';

/**
 * The blockers `design ready` refuses `part` for: the ones `design check --part` records from, with the render issues
 * of `issues` decided as check decides them. Runs the slow rules of the part first when their result is pending.
 */
export const readyBlockersOf = async (options: {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  part: string;
  issues: RenderIssue[];
}) => {
  const { target, config, product, part } = options;

  if (slowProblemsOf({ product, part }) === 'pending') await runSlowChecks({ target, config, product, parts: [part] });

  const found = renderFindingsOf({ target, resolved: [product], issues: options.issues, part });

  return checkBlockersOf({
    product,
    part,
    inputs: withFoundRules({ ...buildReadyInputsOf(product), pointsOf: () => [] }, (at) =>
      found.rulesOf(product.name, at),
    ),
  });
};

/**
 * `et design ready <layer>/<name> …` checks a part and writes its check record, and exits 1 with its open points, its
 * other blockers or its failed `design actions` lines while it has any. It runs the slow rules of the part first when
 * their result is missing or stale.
 */
export const designReady = async (options: { target: string; argv: string[]; invocation: string }) => {
  const { target, argv, invocation } = options;
  const args = argsOf(argv, { values: ['--product', '--url', '--by'], switches: [] });
  const usage = `usage: ${invocation} ${READY_USAGE}`;

  if (typeof args === 'string' || args.positional.length !== 1) {
    if (typeof args === 'string') console.error(args);

    console.error(usage);

    return 2;
  }

  const config = configOf(target);
  const parsed = parseTarget(args.positional[0]);

  if (typeof config === 'string' || typeof parsed === 'string') {
    console.error(typeof config === 'string' ? config : parsed);

    return 1;
  }

  const product = oneProductOf({ target, config, asked: args.values['--product'] });

  if (typeof product === 'string') {
    console.error(product);

    return 1;
  }

  for (const line of staleDistWarningsOf({ target, config })) console.warn(line);

  const author = authorOf(args);

  if (!author) {
    console.error(`a ready mark needs --by <model id | designer>\n${usage}`);

    return 2;
  }

  const refreshed = refreshHarnessMap({ target, product });

  if (typeof refreshed === 'string') {
    console.error(`the harness map is stale and could not be regenerated: ${refreshed}`);

    return 1;
  }

  if (refreshed) console.log('regenerated the stale harness map');

  const part = partKeyOf(parsed);

  settleCommittedEdits({ target, product, parts: [part] });

  const located = readyPartOf({ product, part });
  let drawn: RenderIssue[] = [];
  const marked = await markPartReady({
    product,
    part,
    origin: originOf(author, 'ready'),
    commitIn: target,
    hash: typeof located === 'string' ? '-' : located.hash,
    pointsOf: async () => {
      const findings = await drawnFindingsOf({ target, config, product, parts: [part] });

      if ('unavailable' in findings) return { status: 503, error: `cannot draw ${part}: ${findings.unavailable}` };

      drawn = findings.issues;

      return partPointsOf(
        readOpenPoints(product, { missingStates: findings.missingStates, busyStates: findings.busyStates }),
        part,
      );
    },
    blockersOf: () => readyBlockersOf({ target, config, product, part, issues: drawn }),
    actionsOf: async () => {
      const failures = await partActionFailuresOf({ target, config, product, part, url: args.values['--url'] });

      return Array.isArray(failures)
        ? failures
        : { status: 503, error: `cannot check the actions of ${part}: ${failures.noVerdict}` };
    },
    declaredActionsOf: async () => {
      const declared = await declaredPartActionsOf({ target, config, product, part });

      if (typeof declared === 'string') console.warn(`ACTIONS NOT RECORDED ${part}: ${declared}`);

      return declared;
    },
    ...(args.values['--url'] ? {} : { actionsNote: PART_HARNESS_ONLY }),
  });

  if ('status' in marked) {
    if (marked.points)
      openPointsText(product.name, [{ part, points: marked.points }]).forEach((line) => console.error(line));

    marked.blockers?.forEach((blocker) =>
      console.error(`  ${blocker.kind}: ${blocker.text}${blocker.part ? ` (${blocker.part})` : ''}`),
    );
    marked.actions?.forEach((line) => console.error(`  ${line}`));

    console.error(marked.error);

    return 1;
  }

  console.log(`${part} is build-ready in ${product.name}`);

  return 0;
};
