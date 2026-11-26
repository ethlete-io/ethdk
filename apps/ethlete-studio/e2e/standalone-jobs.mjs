import { spawn } from 'node:child_process';
import { join } from 'node:path';

export const STANDALONE_PAGE = 'Standalone';

export const STANDALONE_FILES = [
  { file: 'frame-link.e2e.mjs', takesBuilt: true },
  { file: 'frame-load-failed.e2e.mjs', takesBuilt: true, ownShard: true },
  { file: 'frame-scrollbar.e2e.mjs', takesBuilt: false },
  { file: 'server-restart.e2e.mjs', takesBuilt: true },
];

/** The standalone e2e files as canvas.e2e queue jobs, filtered by `--case` (file name) and `--page Standalone`. */
export const standaloneJobsOf = ({ only, pageGroups } = {}) =>
  STANDALONE_FILES.filter(
    ({ file }) =>
      (!only || only.split('|').some((part) => file.includes(part))) &&
      (!pageGroups || pageGroups.includes(STANDALONE_PAGE)),
  ).map(({ file, takesBuilt, ownShard = false }) => ({
    page: STANDALONE_PAGE,
    name: file,
    file,
    takesBuilt,
    ownShard,
  }));

/** The timed cases of a standalone file, from its `PASS  12.3s  name: detail` verdict lines. */
export const casesOf = (verdicts) =>
  verdicts.flatMap((line) => {
    const match = /^(PASS|FAIL)\s+([\d.]+)s\s+(.+?):\s/.exec(`${line} `);

    return match ? [{ ok: match[1] === 'PASS', ms: Number(match[2]) * 1000, name: match[3] }] : [];
  });

/** Runs one standalone job as its own node process and resolves to a canvas.e2e result row. */
export const runStandalone = (job, { built, port, env = process.env }) =>
  new Promise((done) => {
    const startedAt = performance.now();
    const child = spawn(
      process.execPath,
      [join(import.meta.dirname, job.file), ...(job.takesBuilt && built ? ['--built', built] : [])],
      { env: { ...env, DE_PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let output = '';

    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.on('data', (chunk) => (output += chunk));
    child.on('exit', (code) => {
      const verdicts = output
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => /^(PASS|FAIL)\b/.test(line));

      done({
        ok: code === 0,
        detail: code === 0 ? verdicts.join(' | ') : `exited with ${code}\n${output.slice(-3000)}`,
        ms: performance.now() - startedAt,
        cases: casesOf(verdicts),
      });
    });
  });
