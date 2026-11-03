import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SKETCH_FILE = /^(\.ethlete\/design\/[^/]+\/sketches\/[^/]+)\//;

export const sketchDirsOf = (files) => [...new Set(files.map((file) => SKETCH_FILE.exec(file)?.[1]).filter(Boolean))];

export const unreadyRoundOf = (dir, sketchJson) => {
  if (sketchJson === null) return null;

  const sketch = JSON.parse(sketchJson);
  const running = sketch.rounds?.at(-1);
  const drawn = Object.keys(sketch.variantInfo ?? {}).length > 0 && (running?.note ?? '').trim() !== '';

  if (!drawn || sketch.status === 'ready' || sketch.hold) return null;

  return `ROUND-NOT-READY ${sketch.target}: round ${running.key} is drawn but still in progress - run \`design sketch ready ${sketch.target}\` (or hold it) before committing ${dir}`;
};

export const unreadyRoundsOf = (files, readStaged) =>
  sketchDirsOf(files)
    .map((dir) => unreadyRoundOf(dir, readStaged(`${dir}/sketch.json`)))
    .filter(Boolean);

const stagedFile = (path) => {
  try {
    return execFileSync('git', ['show', `:${path}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const files = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
  const problems = unreadyRoundsOf(files, stagedFile);

  problems.forEach((problem) => console.error(problem));
  process.exit(problems.length > 0 ? 1 : 0);
}
