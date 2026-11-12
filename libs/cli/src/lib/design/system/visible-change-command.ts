import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, relative } from 'path';
import { DesignConfig, readConfig } from '../design-config';
import { shootStates, ShootStates, StateShot } from './compare-command';
import { baseCheckoutOf, baseCommitOf, git, gitOrNull } from './base-checkout';
import { harnessEntriesOf, harnessOf, harnessStaleOf } from './harness-map';
import { HarnessServer, startHarnessServer, StartHarnessServer } from './harness-server';
import { resolveProduct, ResolvedProduct } from './resolve-product';
import {
  mergedPartsOf,
  PartDiff,
  SketchEvidence,
  sketchedPartsOf,
  StateDiff,
  stateDiffOf,
  VisibleChangeVerdict,
  visibleChangeSummaryOf,
  visibleChangeVerdictOf,
} from './visible-change';

/** Each `sketch.json` of the product a commit in base..HEAD touched, as that commit left it or, if it deleted it, as before. */
export const sketchEvidenceOf = (options: { root: string; base: string; productDir: string }): SketchEvidence[] => {
  const dir = relative(options.root, options.productDir);
  const merged = `${dir}/merged.json`;
  const log = git(options.root, [
    'log',
    '--format=%x01%H',
    '--name-only',
    `${options.base}..HEAD`,
    '--',
    `${dir}/sketches/*/sketch.json`,
    merged,
  ]);
  const evidence: SketchEvidence[] = [];

  for (const entry of log.split('\x01').slice(1)) {
    const [sha = '', ...files] = entry.split('\n').filter(Boolean);
    const recordsMerge = files.includes(merged);

    for (const file of files.filter((candidate) => candidate.endsWith('/sketch.json'))) {
      const kept = gitOrNull(options.root, ['show', `${sha}:${file}`]);
      const before = kept === null ? gitOrNull(options.root, ['show', `${sha}^:${file}`]) : null;

      if (kept !== null) evidence.push({ text: kept, merged: false });
      else if (before !== null) evidence.push({ text: before, merged: recordsMerge });
    }
  }

  return evidence;
};

/** The parts a sketch merge recorded in the product's `merged.json` in base..HEAD, also of a sketch never committed. */
export const mergedInRangeOf = (options: { root: string; base: string; productDir: string }) => {
  const file = `${relative(options.root, options.productDir)}/merged.json`;

  return mergedPartsOf({
    base: gitOrNull(options.root, ['show', `${options.base}:${file}`]),
    head: gitOrNull(options.root, ['show', `HEAD:${file}`]),
  });
};

const fileNameOf = (value: string) => value.replace(/[^\w.-]/g, '-');

const stateLineOf = (state: StateDiff) =>
  state.kind === 'differs'
    ? `${state.state} differs (${state.base} -> ${state.head} px off the design)`
    : state.kind === 'new'
      ? `${state.state} has no base picture (${state.head} px off the design)`
      : state.kind === 'broken' || state.kind === 'unjudged' || state.kind === 'undrivable'
        ? `${state.state} ${state.kind}: ${state.problem}`
        : `${state.state} same`;

const verdictLineOf = (verdict: VisibleChangeVerdict, range: string) => {
  const states = verdict.changed.join(', ');

  switch (verdict.why) {
    case 'invisible':
      return `PASS ${verdict.part}: no visible change`;
    case 'sketched':
      return `PASS ${verdict.part}: ${states} changed with a picked or merged sketch in ${range}`;
    case 'closer':
      return `PASS ${verdict.part}: ${states} changed closer to the design`;
    case 'matches':
      return `PASS ${verdict.part}: ${states} new, matches its design`;
    case 'broken':
      return `FAIL ${verdict.part}: the app no longer draws ${states}`;
    case 'unjudged':
      return `FAIL ${verdict.part}: ${verdict.unjudged.length} state(s) unjudged (${verdict.unjudged.join(', ')})${verdict.reasons.length > 0 ? `: ${verdict.reasons.join('; ')}` : ''}`;
    case 'visible':
      return `FAIL ${verdict.part}: ${states} look different, with no picked or merged sketch of the part in ${range} and not closer to the design`;
  }
};

const shotsOf = async (options: {
  shoot: ShootStates;
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  part: string;
  url: string;
}) => {
  const shot = await options.shoot({ ...options, url: options.url, only: null, appOnly: true });

  return typeof shot === 'string' ? shot : shot.shots;
};

/**
 * `et design check --product <name>… --visible-change [--base <rev>] [--part <part>…]` draws each harness part's states in the app at
 * the base commit and at HEAD, against HEAD's design, and fails a part that looks different unless a picked or merged
 * sketch of it is in base..HEAD or every changed state moved closer to the design.
 */
export const checkVisibleChange = async (options: {
  target: string;
  config: DesignConfig;
  products: string[];
  base: string | undefined;
  parts?: string[];
  shoot?: ShootStates;
  start?: StartHarnessServer;
  onVerdict?: (options: { product: string; verdict: VisibleChangeVerdict; line: string }) => void;
  onProblem?: (options: { product: string; line: string }) => void;
}): Promise<number> => {
  const { target, config } = options;
  const shoot = options.shoot ?? shootStates;
  const start = options.start ?? startHarnessServer;
  const root = gitOrNull(target, ['rev-parse', '--show-toplevel'])?.trim();

  if (!root) {
    console.log(`${target} is not a git checkout`);

    return 1;
  }

  const branch = options.products
    .map((name) => config.products?.[name]?.harness?.baseBranch)
    .find((candidate) => candidate !== undefined);
  const commit = baseCommitOf({ root, base: options.base, branch });

  if (!/^[0-9a-f]{40}$/.test(commit)) {
    console.log(commit);
    options.products.forEach((product) => options.onProblem?.({ product, line: commit }));

    return 1;
  }

  const range = `${commit.slice(0, 9)}..HEAD`;
  const started = Date.now();
  const checkout = baseCheckoutOf({ root, commit });
  const servers: HarnessServer[] = [];
  const verdicts: VisibleChangeVerdict[] = [];
  let problems = 0;

  process.env['NX_DAEMON'] ??= 'false';

  try {
    for (const name of options.products) {
      const entry = config.products?.[name];

      const problem = (line: string) => {
        console.log(line);
        options.onProblem?.({ product: name, line });
        problems++;
      };

      if (!entry) {
        problem(`NO PRODUCT "${name}" in config.json.`);
        continue;
      }

      const product = resolveProduct({ target, name, config: entry });
      const harness = harnessOf(product);

      if (harness === null) {
        console.log(`${name}: no harness in config.json - nothing to gate`);
        continue;
      }

      const stale = typeof harness === 'string' ? harness : harnessStaleOf({ target, product });

      if (typeof harness === 'string' || stale !== null) {
        problem(`${name}: ${stale}`);
        continue;
      }

      const entries = harnessEntriesOf({ target, product, map: harness.map });

      if (typeof entries === 'string') {
        problem(`${name}: ${entries}`);
        continue;
      }

      const baseEntry = readConfig(checkout.dir)?.products?.[name];
      const baseProduct = baseEntry ? resolveProduct({ target: checkout.dir, name, config: baseEntry }) : null;
      const [head, base] = await Promise.all([
        start({ target, product }),
        baseProduct && harnessOf(baseProduct) ? start({ target: checkout.dir, product: baseProduct }) : null,
      ]);

      for (const server of [head, base]) if (server && typeof server !== 'string') servers.push(server);

      if (typeof head === 'string') {
        problem(`${name}: the HEAD harness app did not start: ${head}`);
        continue;
      }

      if (typeof base === 'string')
        console.log(`${name}: the base harness app did not start, so every part counts as new: ${base}`);

      const baseUrl = base && typeof base !== 'string' ? base.url : null;
      const sketched = new Set([
        ...sketchedPartsOf(sketchEvidenceOf({ root, base: commit, productDir: product.dir })),
        ...mergedInRangeOf({ root, base: commit, productDir: product.dir }),
      ]);
      let pictures: string | null = null;

      for (const { part } of entries.filter((candidate) => !options.parts || options.parts.includes(candidate.part))) {
        const shooting = { shoot, target, config, product, part };
        const headShots = await shotsOf({ ...shooting, url: head.url });
        const baseShots = baseUrl === null ? null : await shotsOf({ ...shooting, url: baseUrl });
        const states: StateDiff[] =
          typeof headShots === 'string'
            ? [{ state: '*', kind: Array.isArray(baseShots) ? 'broken' : 'unjudged', problem: headShots }]
            : headShots.map((shot) =>
                stateDiffOf({
                  head: shot,
                  base: Array.isArray(baseShots)
                    ? (baseShots.find((candidate: StateShot) => candidate.state === shot.state) ?? null)
                    : null,
                }),
              );
        const diff: PartDiff = { part, states };
        const verdict = visibleChangeVerdictOf({ diff, sketched });

        const line = verdictLineOf(verdict, range);

        console.log(`${name}: ${line}`);
        options.onVerdict?.({ product: name, verdict, line });

        for (const state of states) {
          if (state.kind === 'same') continue;
          if (verdict.why !== 'invisible' || state.kind === 'undrivable') console.log(`  ${stateLineOf(state)}`);
          if (state.kind !== 'differs') continue;

          pictures ??= mkdtempSync(join(tmpdir(), 'et-design-visible-change-'));
          writeFileSync(join(pictures, `${fileNameOf(part)}.${fileNameOf(state.state)}.diff.png`), state.diff);
        }

        verdicts.push(verdict);
      }

      if (pictures !== null) console.log(`${name}: base/HEAD diff pictures: ${pictures}`);
    }
  } finally {
    await Promise.all(servers.map((server) => server.stop()));
    checkout.release();
  }

  console.log(
    visibleChangeSummaryOf({ verdicts, problems, range, seconds: Math.round((Date.now() - started) / 1000) }),
  );

  return problems === 0 && verdicts.every((verdict) => verdict.pass) ? 0 : 1;
};
