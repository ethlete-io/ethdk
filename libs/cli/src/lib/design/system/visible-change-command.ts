import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join, relative } from 'path';
import { DesignConfig, readConfig } from '../paths';
import { shootStates, ShootStates, StateShot } from './compare-command';
import { harnessEntriesOf, harnessOf, harnessStaleOf } from './harness-map';
import { HarnessServer, startHarnessServer, StartHarnessServer } from './harness-server';
import { resolveProduct, ResolvedProduct } from './resolve-product';
import {
  PartDiff,
  SketchEvidence,
  sketchedPartsOf,
  StateDiff,
  stateDiffOf,
  VisibleChangeVerdict,
  visibleChangeSummaryOf,
  visibleChangeVerdictOf,
} from './visible-change';

const DEFAULT_BASE = 'origin/next';

const git = (cwd: string, args: string[]) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });

const gitOrNull = (cwd: string, args: string[]) => {
  try {
    return git(cwd, args);
  } catch {
    return null;
  }
};

/** The commit the gate compares HEAD with: `--base`, else the merge base of HEAD and origin/next. */
export const baseCommitOf = (options: { root: string; base: string | undefined }) => {
  const rev = options.base ?? gitOrNull(options.root, ['merge-base', 'HEAD', DEFAULT_BASE])?.trim();

  if (!rev) return `no merge base of HEAD and ${DEFAULT_BASE} - pass --base <rev>`;

  return (
    gitOrNull(options.root, ['rev-parse', '--verify', '--quiet', `${rev}^{commit}`])?.trim() || `no commit "${rev}"`
  );
};

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

const linkNodeModules = (options: { root: string; clone: string }) => {
  const { root, clone } = options;
  const modules = join(root, 'node_modules');
  const linked = join(clone, 'node_modules');

  if (!existsSync(linked) && existsSync(modules)) {
    mkdirSync(linked);

    for (const name of readdirSync(modules)) {
      const entry = join(modules, name);

      if (lstatSync(entry).isSymbolicLink()) symlinkSync(readlinkSync(entry), join(linked, name));
      else if (name === '@ethlete') {
        mkdirSync(join(linked, name));

        for (const scoped of readdirSync(entry)) {
          const from = join(entry, scoped);

          symlinkSync(lstatSync(from).isSymbolicLink() ? readlinkSync(from) : from, join(linked, name, scoped));
        }
      } else symlinkSync(entry, join(linked, name));
    }
  }

  for (const top of ['libs', 'apps', 'tools']) {
    if (!existsSync(join(root, top))) continue;

    for (const name of readdirSync(join(root, top))) {
      const nested = join(top, name, 'node_modules');

      if (existsSync(join(root, nested)) && existsSync(join(clone, top, name)) && !existsSync(join(clone, nested)))
        symlinkSync(join(root, nested), join(clone, nested));
    }
  }
};

const alive = (pid: number) => {
  try {
    process.kill(pid, 0);

    return true;
  } catch {
    return false;
  }
};

/**
 * A shared clone of the checkout at `commit`, with the checkout's node_modules linked in. It reuses one folder per
 * checkout so the harness build cache, keyed by that path, survives runs; a second run at once gets a fresh folder.
 */
const baseCheckoutOf = (options: { root: string; commit: string }) => {
  const stable = join(
    tmpdir(),
    'et-design-visible-change',
    createHash('sha256').update(options.root).digest('hex').slice(0, 16),
  );
  const lock = `${stable}.lock`;

  mkdirSync(join(stable, '..'), { recursive: true });

  const held = existsSync(lock) && alive(Number(readFileSync(lock, 'utf8')));
  const dir = held ? mkdtempSync(join(tmpdir(), 'et-design-visible-change-')) : stable;

  if (!held) writeFileSync(lock, String(process.pid));

  if (existsSync(join(dir, '.git'))) git(dir, ['checkout', '--quiet', '--force', '--detach', options.commit]);
  else {
    rmSync(dir, { recursive: true, force: true });
    git(options.root, ['clone', '--quiet', '--shared', '--no-checkout', options.root, dir]);
    git(dir, ['checkout', '--quiet', '--detach', options.commit]);
  }

  linkNodeModules({ root: options.root, clone: dir });

  return {
    dir,
    release: () => (held ? rmSync(dir, { recursive: true, force: true }) : rmSync(lock, { force: true })),
  };
};

const fileNameOf = (value: string) => value.replace(/[^\w.-]/g, '-');

const stateLineOf = (state: StateDiff) =>
  state.kind === 'differs'
    ? `${state.state} differs (${state.base} -> ${state.head} px off the design)`
    : state.kind === 'new'
      ? `${state.state} has no base picture`
      : state.kind === 'broken' || state.kind === 'unjudged'
        ? `${state.state} ${state.kind}: ${state.problem}`
        : `${state.state} same`;

const verdictLineOf = (verdict: VisibleChangeVerdict, range: string) => {
  const states = verdict.changed.join(', ');

  switch (verdict.why) {
    case 'invisible':
      return `PASS ${verdict.part}: no visible change${verdict.unjudged.length > 0 ? ` (unjudged: ${verdict.unjudged.join(', ')})` : ''}`;
    case 'sketched':
      return `PASS ${verdict.part}: ${states} changed with a picked or merged sketch in ${range}`;
    case 'closer':
      return `PASS ${verdict.part}: ${states} changed closer to the design`;
    case 'broken':
      return `FAIL ${verdict.part}: the app no longer draws ${states}`;
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
  const shot = await options.shoot({ ...options, url: options.url, only: null });

  return typeof shot === 'string' ? shot : shot.shots;
};

/**
 * `et design check --product <name>… --visible-change [--base <rev>]` draws each harness part's states in the app at
 * the base commit and at HEAD, against HEAD's design, and fails a part that looks different unless a picked or merged
 * sketch of it is in base..HEAD or every changed state moved closer to the design.
 */
export const checkVisibleChange = async (options: {
  target: string;
  config: DesignConfig;
  products: string[];
  base: string | undefined;
  shoot?: ShootStates;
  start?: StartHarnessServer;
}): Promise<number> => {
  const { target, config } = options;
  const shoot = options.shoot ?? shootStates;
  const start = options.start ?? startHarnessServer;
  const root = gitOrNull(target, ['rev-parse', '--show-toplevel'])?.trim();

  if (!root) {
    console.log(`${target} is not a git checkout`);

    return 1;
  }

  const commit = baseCommitOf({ root, base: options.base });

  if (!/^[0-9a-f]{40}$/.test(commit)) {
    console.log(commit);

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

      if (!entry) {
        console.log(`NO PRODUCT "${name}" in config.json.`);
        problems++;
        continue;
      }

      const product = resolveProduct({ target, name, config: entry });
      const harness = harnessOf(product);

      if (harness === null) {
        console.log(`${name}: no harness in config.json - nothing to gate`);
        continue;
      }

      const problem = typeof harness === 'string' ? harness : harnessStaleOf({ target, product });

      if (typeof harness === 'string' || problem !== null) {
        console.log(`${name}: ${problem}`);
        problems++;
        continue;
      }

      const entries = harnessEntriesOf({ target, product, map: harness.map });

      if (typeof entries === 'string') {
        console.log(`${name}: ${entries}`);
        problems++;
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
        console.log(`${name}: the HEAD harness app did not start: ${head}`);
        problems++;
        continue;
      }

      if (typeof base === 'string')
        console.log(`${name}: the base harness app did not start, so every part counts as new: ${base}`);

      const baseUrl = base && typeof base !== 'string' ? base.url : null;
      const sketched = sketchedPartsOf(sketchEvidenceOf({ root, base: commit, productDir: product.dir }));
      let pictures: string | null = null;

      for (const { part } of entries) {
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

        console.log(`${name}: ${verdictLineOf(verdict, range)}`);

        for (const state of states) {
          if (state.kind === 'same') continue;
          if (verdict.why !== 'invisible') console.log(`  ${stateLineOf(state)}`);
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
