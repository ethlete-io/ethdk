import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, normalize, relative } from 'node:path';

const require = createRequire(import.meta.url);

const loadUpdate = (sdkRoot) => {
  const base = join(sdkRoot, 'dist/libs/cli/src/lib/update');
  return {
    plan: require(join(base, 'plan.js')),
    manifest: require(join(base, 'migration-manifest.js')),
    run: require(join(base, 'run-migrations.js')),
  };
};

export const installedVersions = (scopeDir, libs) =>
  Object.fromEntries(
    libs.flatMap((lib) => {
      try {
        const { version } = JSON.parse(readFileSync(join(scopeDir, lib, 'package.json'), 'utf8'));
        return [[`@ethlete/${lib}`, version]];
      } catch {
        return [];
      }
    }),
  );

/** The required migrations `et update` runs when moving each package from `from` to `to`. */
export const pendingSmokeMigrations = ({ sdkRoot, root, from, to }) => {
  const { plan, manifest } = loadUpdate(sdkRoot);
  const pending = [];
  for (const [packageName, start] of Object.entries(from)) {
    const target = to[packageName];
    if (target === undefined || start === target) continue;
    const packageMigrations = manifest.readPackageMigrations({ root, packageName });
    pending.push(...plan.pendingMigrations({ packageMigrations, from: start, to: target }));
  }
  return plan.orderMigrations(pending);
};

const INSTALL_SCRIPTS = ['preinstall', 'install', 'postinstall'];

const packageManager = (root, manifest) => {
  const declared = /^(npm|yarn|pnpm)@/.exec(manifest.packageManager ?? '')?.[1];
  if (declared) return declared;
  if (existsSync(join(root, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(root, 'yarn.lock'))) return 'yarn';
  return 'npm';
};

/** Runs the root package's install scripts in `root`, as an install would, and throws when one fails. */
const runInstallScripts = (root) => {
  const manifestPath = join(root, 'package.json');
  if (!existsSync(manifestPath)) return;
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const manager = packageManager(root, manifest);
  for (const script of INSTALL_SCRIPTS.filter((name) => manifest.scripts?.[name])) {
    console.log(`  $ ${manager} run ${script}`);
    const result = spawnSync(manager, ['run', script], { cwd: root, stdio: 'inherit' });
    if (result.status !== 0) throw new Error(`${manager} run ${script} failed in ${root} (exit ${result.status})`);
  }
};

/**
 * Copies the consumer's tracked and unignored files into a scratch dir, links its node_modules in, and runs the
 * install scripts the link skips, so the files they generate exist in the copy.
 */
export const copyConsumer = (appRoot) => {
  const dest = mkdtempSync(join(tmpdir(), 'release-smoke-src-'));
  const listed = spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    cwd: appRoot,
    maxBuffer: 256 * 1024 * 1024,
  });
  if (listed.status !== 0) throw new Error(`git ls-files failed in ${appRoot}`);
  for (const file of listed.stdout.toString().split('\0').filter(Boolean)) {
    const source = join(appRoot, file);
    if (!existsSync(source)) continue;
    mkdirSync(dirname(join(dest, file)), { recursive: true });
    cpSync(source, join(dest, file), { recursive: true, verbatimSymlinks: true });
  }
  symlinkSync(join(appRoot, 'node_modules'), join(dest, 'node_modules'), 'dir');
  try {
    runInstallScripts(dest);
  } catch (error) {
    rmSync(dest, { recursive: true, force: true });
    throw error;
  }
  return dest;
};

/** Runs the pending `et update` migrations in `root`, returning one line per outcome. */
export const runSmokeMigrations = ({ sdkRoot, root, pending }) => {
  const { run } = loadUpdate(sdkRoot);
  const manager = { name: 'npm', install: ['npm', 'install'], run: ['npx'] };
  let outcomes;
  try {
    outcomes = run.runPendingMigrations({ root, manager, pending, dryRun: false });
  } catch (error) {
    return [`migration runner threw (${error instanceof Error ? error.message : String(error)}) failed`];
  }
  return outcomes.map(
    (outcome) =>
      `${outcome.pending.packageName}:${outcome.pending.migration.name} ${outcome.state}${outcome.reason ? ` (${outcome.reason})` : ''}`,
  );
};

/** Maps every file under `root` (node_modules and .git excluded) to a content hash. */
export const snapshotFiles = (root) => {
  const hashes = new Map();
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile())
        hashes.set(relative(root, path), createHash('sha1').update(readFileSync(path)).digest('hex'));
    }
  };
  walk(root);
  return hashes;
};

/** Files added, removed or changed between two snapshots. */
export const changedFiles = (before, after) =>
  new Set([...new Set([...before.keys(), ...after.keys()])].filter((file) => before.get(file) !== after.get(file)));

const ANSI = /\u001b\[[0-9;]*m/g;
const PAREN_ERROR = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/;
const COLON_ERROR = /^(?:\[ERROR\] |Error: )?(.+?):(\d+):(\d+) - error (TS\d+): (.*)$/;

/** Compiler errors in TS (`path(line,col): error TSxxxx`) or Angular (`path:line:col - error TSxxxx`) format. */
export const parseBuildErrors = (output) =>
  output
    .replace(ANSI, '')
    .split(/\r?\n/)
    .flatMap((line) => {
      const match = PAREN_ERROR.exec(line.trim()) ?? COLON_ERROR.exec(line.trim());
      return match
        ? [{ file: match[1], line: Number(match[2]), column: Number(match[3]), code: match[4], message: match[5] }]
        : [];
    });

/** Splits build errors into those in a file a migration rewrote (fail) and those in untouched consumer state (warn). */
export const classifyBuildErrors = ({ errors, rewritten, root }) => {
  const rewrittenErrors = [];
  const untouchedErrors = [];
  for (const error of errors) {
    const file = isAbsolute(error.file) ? relative(root, error.file) : normalize(error.file);
    (rewritten.has(file) ? rewrittenErrors : untouchedErrors).push({ ...error, file });
  }
  return { rewrittenErrors, untouchedErrors };
};

export const formatBuildError = (error) => `${error.file}:${error.line}:${error.column} ${error.code} ${error.message}`;

/** Decides FAIL (failures) or WARN (warnings) for one consumer after its migrations ran and its build finished. */
export const judgeSmokeBuild = ({ migrationLines, buildCode, buildOutput, rewritten, root }) => {
  const failures = [];
  const warnings = [];
  const failedMigration = migrationLines.find((line) => / (failed|not-run)\b/.test(line));
  if (failedMigration) {
    failures.push(`et update migration did not apply in the copy: ${failedMigration}`);
    return { failures, warnings };
  }
  if (buildCode === 0) return { failures, warnings };
  const { rewrittenErrors, untouchedErrors } = classifyBuildErrors({
    errors: parseBuildErrors(buildOutput),
    rewritten,
    root,
  });
  if (rewrittenErrors.length || !untouchedErrors.length) {
    failures.push(`production build exited with ${buildCode}`);
    for (const error of rewrittenErrors)
      failures.push(`build error in a file a migration rewrote: ${formatBuildError(error)}`);
    return { failures, warnings };
  }
  for (const error of untouchedErrors)
    warnings.push(`WARN consumer build red in a file no pending migration touched: ${formatBuildError(error)}`);
  return { failures, warnings };
};
