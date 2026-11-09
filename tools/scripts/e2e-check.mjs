import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { availableParallelism, loadavg, tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { join, sep } from 'node:path';
import { selectE2eFolders, readIndex, ALL } from '../../apps/storybook-e2e/affected.mjs';
import { linkNodeModules } from './link-node-modules.mjs';
import { mapChanged, suiteInvocation } from './e2e-map.mjs';

const SUITE_TIMEOUT_MS = 15 * 60 * 1000;

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 1 << 28 }).trim();

const changedFilesOf = (repo, commit) =>
  git(repo, 'diff-tree', '--no-commit-id', '--name-only', '-r', '--no-renames', '--root', commit)
    .split('\n')
    .filter(Boolean);

export const cliBuildProblem = (dir) => {
  const dist = join(dir, 'dist/libs/cli');

  if (!existsSync(join(dist, 'src/index.js'))) return 'dist/libs/cli is missing from the tree';

  if (!(realpathSync(dist) + sep).startsWith(realpathSync(dir) + sep))
    return `dist/libs/cli of the tree resolves outside it (${realpathSync(dist)})`;

  if (!existsSync(join(dir, 'libs/cli/src/lib/source-hash.ts'))) return undefined;

  let recorded;
  try {
    recorded = JSON.parse(readFileSync(join(dist, 'build-info.json'), 'utf8')).sourceHash;
  } catch {
    return 'dist/libs/cli of the tree has no build-info.json';
  }

  const { cliSourceHash } = createRequire(import.meta.url)(join(dist, 'src/lib/source-hash.js'));

  return recorded === cliSourceHash(join(dir, 'libs/cli'))
    ? undefined
    : 'dist/libs/cli of the tree was not built from the tree revision (source hash differs)';
};

export const createRevisionWorktree = (repo, commit) => {
  const dir = join(mkdtempSync(join(tmpdir(), 'e2e-check-tree-')), 'tree');
  git(repo, 'worktree', 'add', '--detach', dir, commit);
  linkNodeModules(repo, dir);

  let removed = false;
  const remove = () => {
    if (removed) return;
    removed = true;
    try {
      git(repo, 'worktree', 'remove', '--force', dir);
    } catch {
      rmSync(dir, { recursive: true, force: true });
      spawnSync('git', ['worktree', 'prune'], { cwd: repo });
    }
    rmSync(join(dir, '..'), { recursive: true, force: true });
  };

  return { dir, sha: git(dir, 'rev-parse', 'HEAD'), remove };
};

const HEARTBEAT_MS = 30 * 1000;
export const IDLE_MS = Number(process.env['E2E_CHECK_IDLE_MS']) || 3 * 60 * 1000;
const CASE_LINE = /^((PASS|FAIL)\b| {2}[✓✘] )/m;
const START_LINE = /^RUN\b/;
const FAIL_LINE = /^FAIL\b/;
const TIMING_FAIL_LINE = /^FAIL\s+\[timing\]/;
const TOTAL_LINE = /^(\d+)\/(\d+) passed/m;

export const sampleLoad = () => ({ load: loadavg()[0], cores: availableParallelism() });

const onlyTimingFailures = (text) => {
  const failed = text.split('\n').filter((line) => FAIL_LINE.test(line));
  return failed.length > 0 && failed.every((line) => TIMING_FAIL_LINE.test(line));
};

export const judgeSuiteRun = ({ status, timedOut, idle, output, load = 0, cores = Infinity }) => {
  const text = output.trim();
  const total = TOTAL_LINE.exec(text);

  if (idle) return { ok: false, reason: `no output for ${Math.round(idle / 1000)}s` };
  if (timedOut) return { ok: false, reason: 'timed out' };
  if (total && Number(total[2]) === 0) return { ok: false, reason: 'ran zero cases' };
  if (status !== 0 && load > cores && onlyTimingFailures(text))
    return { ok: false, notMeasured: true, reason: `NOT MEASURED (load ${load.toFixed(1)})` };
  if (status !== 0) return { ok: false, reason: CASE_LINE.test(text) ? 'failed' : 'crashed before its first case' };
  if (!text) return { ok: false, reason: 'produced no output' };

  return { ok: true, reason: '' };
};

export const runSuite = (
  repo,
  suite,
  built,
  { script, onLine = () => undefined, heartbeatMs = HEARTBEAT_MS, idleMs = IDLE_MS, sample = sampleLoad } = {},
) =>
  new Promise((resolve) => {
    const started = Date.now();
    const invocation = suiteInvocation(suite);
    const child = spawn(
      'node',
      [script ?? invocation.script, ...(script ? [] : invocation.args), ...(built ? ['--built', built] : [])],
      { cwd: repo },
    );
    let output = '';
    let pending = '';
    let cases = 0;
    let timedOut = false;
    let idle = 0;
    let lastCase = '(none yet)';
    let lastOutputAt = Date.now();

    const take = (chunk) => {
      lastOutputAt = Date.now();
      output += chunk;
      pending += chunk;
      const lines = pending.split('\n');
      pending = lines.pop();
      for (const line of lines) {
        if (CASE_LINE.test(line)) cases++;
        if (CASE_LINE.test(line) || START_LINE.test(line)) lastCase = line;
        onLine(line);
      }
    };

    child.stdout.on('data', (chunk) => take(chunk.toString()));
    child.stderr.on('data', (chunk) => take(chunk.toString()));

    const beat = setInterval(
      () => onLine(`... running, ${((Date.now() - started) / 1000).toFixed(0)}s, ${cases} case(s) done`),
      heartbeatMs,
    );
    const watchdog = setInterval(
      () => {
        if (Date.now() - lastOutputAt < idleMs) return;
        idle = Date.now() - lastOutputAt;
        child.kill('SIGKILL');
      },
      Math.max(10, Math.min(idleMs / 4, 5000)),
    );
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, SUITE_TIMEOUT_MS);

    child.on('close', (status) => {
      clearInterval(beat);
      clearInterval(watchdog);
      clearTimeout(timer);
      const { load, cores } = sample();
      resolve({
        ...judgeSuiteRun({ status, timedOut, idle, output, load, cores }),
        load,
        cores,
        timedOut: timedOut || idle > 0,
        lastCase,
        seconds: (Date.now() - started) / 1000,
        tail: output.trim().split('\n').slice(-6).join('\n'),
      });
    });
  });

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const dry = args.includes('--list');
  const commit = args.find((arg) => !arg.startsWith('--'));

  if (!commit) {
    console.error('usage: e2e-check.mjs <commit> [--list]');
    process.exit(2);
  }

  const startedAt = Date.now();
  const stamp = (phase) =>
    console.log(`[e2e-check ${new Date().toISOString()} +${((Date.now() - startedAt) / 1000).toFixed(1)}s] ${phase}`);
  const mainRepo = git(process.cwd(), 'rev-parse', '--show-toplevel');
  const files = changedFilesOf(mainRepo, commit);
  const tree = createRevisionWorktree(mainRepo, commit);
  const repo = tree.dir;
  const cleanup = () => tree.remove();
  process.on('exit', cleanup);
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(signal, () => {
      cleanup();
      process.exit(130);
    });
  }
  const { suites, components, uncovered } = mapChanged(files);
  const results = [];

  console.log(
    `e2e-check ${commit.slice(0, 9)} (suite sha ${tree.sha}, tree ${tree.dir}): ${files.length} changed file${files.length === 1 ? '' : 's'}`,
  );
  uncovered.forEach((file) => console.log(`no e2e covers ${file}`));

  if (suites.length) {
    console.log(`studio suites: ${suites.join(', ')}`);

    if (dry) {
      results.push(...suites.map((suite) => ({ suite, status: 'listed' })));
    } else {
      const scratch = mkdtempSync(join(tmpdir(), 'e2e-check-'));

      try {
        stamp('cli build starting');
        execFileSync('npx', ['nx', 'build', 'cli', '--skip-nx-cache'], {
          cwd: repo,
          stdio: 'ignore',
          env: { ...process.env, NX_NO_CLOUD: 'true' },
        });
        const problem = cliBuildProblem(repo);

        if (problem) throw new Error(`cli build does not match the revision: ${problem}`);

        stamp('studio build starting');
        execFileSync(
          'npx',
          ['nx', 'build', 'ethlete-studio', `--outputPath=${scratch}`, '--excludeTaskDependencies', '--skip-nx-cache'],
          { cwd: repo, stdio: 'ignore', env: { ...process.env, NX_NO_CLOUD: 'true' } },
        );
        stamp('studio build done');
        for (const suite of suites) {
          stamp(`${suite} starting`);
          const run = await runSuite(repo, suite, scratch, {
            onLine: (line) => console.log(`  [${suite}] ${line}`),
          });
          const label = run.ok ? 'PASS' : run.notMeasured ? 'NOT MEASURED' : run.timedOut ? 'TIMEOUT' : 'FAIL';
          console.log(
            `${label} ${suite} (${run.seconds.toFixed(0)}s, load ${run.load.toFixed(1)}/${run.cores} cores)${run.ok ? '' : ` - ${run.reason}`}`,
          );
          if (!run.ok)
            console.log(
              `  last case reached: ${run.lastCase}\n  suite sha ${tree.sha}\n${run.tail.replace(/^/gm, '  ')}`,
            );
          results.push({ suite, status: run.ok ? 'pass' : run.notMeasured ? 'unmeasured' : 'fail' });
        }
      } catch (error) {
        console.log(`FAIL studio build: ${error.message.split('\n')[0]}`);
        results.push(...suites.map((suite) => ({ suite, status: 'fail' })));
      } finally {
        rmSync(scratch, { recursive: true, force: true });
      }
    }
  }

  if (components.length) {
    const selection = selectE2eFolders(files, readIndex(repo));
    const folders = selection === ALL ? [] : selection;
    const label = selection === ALL ? 'every storybook suite' : `storybook suites: ${folders.join(', ') || 'none'}`;
    console.log(label);

    if (selection !== ALL && !folders.length) {
      console.log('no storybook e2e covers the libs/components change');
    } else if (!process.env['STORYBOOK_URL'] && !existsSync(join(repo, 'dist/storybook/index.html'))) {
      console.log('SKIPPED storybook suites: no dist/storybook - run: npx nx build storybook, or set STORYBOOK_URL');
      results.push({ suite: 'storybook', status: 'skipped' });
    } else if (dry) {
      results.push({ suite: 'storybook', status: 'listed' });
    } else {
      const run = spawnSync('yarn', ['e2e:affected', `${commit}^`, '--run'], {
        cwd: repo,
        encoding: 'utf8',
        timeout: SUITE_TIMEOUT_MS * 3,
      });
      console.log(`${run.status === 0 ? 'PASS' : 'FAIL'} storybook`);
      if (run.status !== 0)
        console.log(`${run.stdout ?? ''}${run.stderr ?? ''}`.trim().split('\n').slice(-8).join('\n'));
      results.push({ suite: 'storybook', status: run.status === 0 ? 'pass' : 'fail' });
    }
  }

  const failed = results.filter((r) => r.status === 'fail').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;
  const unmeasured = results.filter((r) => r.status === 'unmeasured').length;
  const passed = results.filter((r) => r.status === 'pass').length;

  if (!results.length) console.log(`NO E2E: ${uncovered.length} changed file(s) have no e2e`);
  else if (failed)
    console.log(`E2E FAIL: ${failed} failed, ${passed} passed, ${skipped} skipped (suite sha ${tree.sha})`);
  else if (unmeasured)
    console.log(
      `E2E NOT MEASURED: ${unmeasured} timing case(s) failed under load, ${passed} passed, ${skipped} skipped - the slice stays unverified until a run under the core count passes (suite sha ${tree.sha})`,
    );
  else if (skipped)
    console.log(`E2E INCOMPLETE: ${passed} passed, ${skipped} skipped (suite sha ${tree.sha}, see above)`);
  else console.log(`E2E OK: ${passed} passed${dry ? ' (listed only)' : ''} (suite sha ${tree.sha})`);

  cleanup();

  process.exit(failed || skipped || unmeasured ? 1 : 0);
}
