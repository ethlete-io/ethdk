import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const BREAKING_HEADER = /^[a-z]+(\([^)]*\))?!:/;

export const isBreakingHeader = (message) => BREAKING_HEADER.test(message.split('\n')[0] ?? '');

export const libsOf = (paths) => [
  ...new Set(paths.map((path) => /^libs\/([^/]+)\//.exec(path)?.[1]).filter((lib) => lib !== undefined)),
];

export const scenarioRunsFor = (message, stagedPaths, hasScenarios) =>
  isBreakingHeader(message)
    ? libsOf(stagedPaths)
        .filter((lib) => hasScenarios(lib))
        .map((lib) => ['vitest', 'run', '--config', `libs/${lib}/vite.config.mts`, `libs/${lib}/src/scenarios`])
    : [];

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const message = readFileSync(process.argv[2], 'utf8');
  const staged = execFileSync('git', ['diff', '--cached', '--name-only'], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
  const runs = scenarioRunsFor(message, staged, (lib) => existsSync(`libs/${lib}/src/scenarios`));
  for (const args of runs) {
    process.stderr.write(`Breaking commit: npx ${args.join(' ')}\n`);
    const { status } = spawnSync('npx', args, { stdio: 'inherit' });
    if (status !== 0) {
      process.stderr.write(`A scenario spec of ${args.at(-1)} fails. Fix it in this commit.\n`);
      process.exit(1);
    }
  }
}
