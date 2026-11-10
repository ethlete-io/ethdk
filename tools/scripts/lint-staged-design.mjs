#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const BASELINE = 'lint-baseline.json';

export const baselineDirOf = (file, exists = existsSync) => {
  for (let dir = dirname(file); dir.startsWith('.ethlete/'); dir = dirname(dir)) {
    if (exists(join(root, dir, BASELINE))) return dir;
  }

  return dirname(file);
};

export const lintKeyOf = (baselineDir, file) => {
  const path = relative(baselineDir, file);
  const sketched = /^sketches\/[^/]+\/([^/]+)\/(.+)$/u.exec(path);

  if (!sketched) return path;

  return sketched[1] === 'shared' ? `shared/${sketched[2]}` : sketched[2];
};

const gitShow = (spec) => {
  const run = spawnSync('git', ['show', spec], { cwd: root, encoding: 'utf8' });

  return run.status === 0 ? run.stdout : null;
};

const committedBaselineOf = (baselineDir) => {
  const path = join(baselineDir, BASELINE);
  const text = gitShow(`HEAD:${path}`) ?? gitShow(`:${path}`);

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
};

/** The refusal lines of `findings` (repo-relative files) over the committed baseline that holds each file. */
export const newFindingLinesOf = (findings, baselineOf = committedBaselineOf, exists = existsSync) => {
  const groups = new Map();

  for (const finding of findings) {
    const dir = baselineDirOf(finding.file, exists);
    const group = `${dir}\n${lintKeyOf(dir, finding.file)}\n${finding.rule}`;

    groups.set(group, [...(groups.get(group) ?? []), finding]);
  }

  const baselines = new Map();

  return [...groups.entries()].flatMap(([group, found]) => {
    const [dir, key, rule] = group.split('\n');

    if (!baselines.has(dir)) baselines.set(dir, baselineOf(dir));

    const allowed = baselines.get(dir)[key]?.[rule] ?? 0;

    if (found.length <= allowed) return [];

    const over = allowed > 0 ? ` (${found.length} in the file, the baseline allows ${allowed})` : '';

    return found.map((each) => `LINT ${each.file}:${each.line}:${each.column} ${each.rule}: ${each.message}${over}`);
  });
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const files = process.argv.slice(2);
  const out = mkdtempSync(join(tmpdir(), 'lint-staged-design-'));
  const report = join(out, 'eslint.json');
  const run = spawnSync(
    process.execPath,
    [
      join(root, 'node_modules/eslint/bin/eslint.js'),
      '--format',
      'json',
      '--output-file',
      report,
      '--no-warn-ignored',
      ...files,
    ],
    { cwd: root, encoding: 'utf8', maxBuffer: 1 << 26 },
  );

  if (run.status !== 0 && run.status !== 1) {
    console.error(`eslint failed (${run.status ?? run.signal}): ${run.stderr || run.stdout}`);
    process.exit(1);
  }

  const results = JSON.parse(readFileSync(report, 'utf8'));

  rmSync(out, { recursive: true, force: true });

  const findings = results.flatMap((result) =>
    result.messages.map((message) => ({
      file: relative(root, result.filePath),
      line: message.line ?? 0,
      column: message.column ?? 0,
      rule: message.ruleId ?? 'parse',
      message: message.message,
    })),
  );
  const lines = newFindingLinesOf(findings);

  if (lines.length > 0) {
    for (const line of lines) console.error(line);
    console.error('staged .ethlete files add lint warnings over their lint-baseline.json - fix them');
    process.exit(1);
  }
}
