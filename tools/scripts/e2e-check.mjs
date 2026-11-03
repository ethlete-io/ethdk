import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { selectE2eFolders, readIndex, ALL } from '../../apps/storybook-e2e/affected.mjs';
import { mapChanged, STUDIO_E2E } from './e2e-map.mjs';

const SUITE_TIMEOUT_MS = 15 * 60 * 1000;

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 1 << 28 }).trim();

const changedFilesOf = (repo, commit) =>
  git(repo, 'diff-tree', '--no-commit-id', '--name-only', '-r', '--no-renames', '--root', commit)
    .split('\n')
    .filter(Boolean);

const runSuite = (repo, suite, built) => {
  const started = Date.now();
  const result = spawnSync('node', [`${STUDIO_E2E}/${suite}.e2e.mjs`, ...(built ? ['--built', built] : [])], {
    cwd: repo,
    encoding: 'utf8',
    timeout: SUITE_TIMEOUT_MS,
    maxBuffer: 1 << 28,
  });
  const tail = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim().split('\n').slice(-6).join('\n');

  return {
    ok: result.status === 0,
    timedOut: result.error?.code === 'ETIMEDOUT',
    seconds: (Date.now() - started) / 1000,
    tail,
  };
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const dry = args.includes('--list');
  const commit = args.find((arg) => !arg.startsWith('--'));

  if (!commit) {
    console.error('usage: e2e-check.mjs <commit> [--list]');
    process.exit(2);
  }

  const repo = git(process.cwd(), 'rev-parse', '--show-toplevel');
  const files = changedFilesOf(repo, commit);
  const { suites, components, uncovered } = mapChanged(files);
  const results = [];

  console.log(`e2e-check ${commit.slice(0, 9)}: ${files.length} changed file${files.length === 1 ? '' : 's'}`);
  uncovered.forEach((file) => console.log(`no e2e covers ${file}`));

  if (suites.length) {
    console.log(`studio suites: ${suites.join(', ')}`);

    if (!existsSync(join(repo, 'dist/libs/cli/src/index.js'))) {
      console.log('SKIPPED studio suites: dist/libs/cli is missing - run: npx nx build cli');
      results.push(...suites.map((suite) => ({ suite, status: 'skipped' })));
    } else if (dry) {
      results.push(...suites.map((suite) => ({ suite, status: 'listed' })));
    } else {
      const scratch = mkdtempSync(join(tmpdir(), 'e2e-check-'));

      try {
        execFileSync(
          'npx',
          ['nx', 'build', 'ethlete-studio', `--outputPath=${scratch}`, '--excludeTaskDependencies', '--skip-nx-cache'],
          { cwd: repo, stdio: 'ignore', env: { ...process.env, NX_NO_CLOUD: 'true' } },
        );
        for (const suite of suites) {
          const run = runSuite(repo, suite, scratch);
          console.log(`${run.ok ? 'PASS' : run.timedOut ? 'TIMEOUT' : 'FAIL'} ${suite} (${run.seconds.toFixed(0)}s)`);
          if (!run.ok) console.log(run.tail.replace(/^/gm, '  '));
          results.push({ suite, status: run.ok ? 'pass' : 'fail' });
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
  const passed = results.filter((r) => r.status === 'pass').length;

  if (!results.length) console.log(`NO E2E: ${uncovered.length} changed file(s) have no e2e`);
  else if (failed) console.log(`E2E FAIL: ${failed} failed, ${passed} passed, ${skipped} skipped`);
  else if (skipped) console.log(`E2E INCOMPLETE: ${passed} passed, ${skipped} skipped (see above)`);
  else console.log(`E2E OK: ${passed} passed${dry ? ' (listed only)' : ''}`);

  process.exit(failed || skipped ? 1 : 0);
}
