import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { linkNodeModules } from './link-node-modules.mjs';

const LOAD_ONLY = '(spec file failed to run)';

const isSpec = (file) => /\.spec\.(ts|mjs)$/.test(file);

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 1 << 28 }).trim();

export const changedFiles = (repo, commit) =>
  git(repo, 'diff-tree', '--no-commit-id', '--name-status', '-r', '--no-renames', '--root', commit)
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [status, file] = line.split('\t');
      return { status, file };
    });

export const owningRoot = (checkout, file) => {
  let dir = dirname(file);
  while (dir !== '.') {
    if (
      ['project.json', 'vitest.config.mts', 'vitest.config.ts', 'vite.config.mts', 'vite.config.ts'].some((n) =>
        existsSync(join(checkout, dir, n)),
      )
    ) {
      return dir;
    }
    dir = dirname(dir);
  }
  return '.';
};

const emptyOfType = (type) => {
  const t = type.trim();
  if (/\[\]$|^(Readonly)?Array<|^readonly\s/.test(t)) return '[]';
  if (/^Promise</.test(t)) return 'Promise.resolve()';
  if (/^(\{|Record<|Partial<|Map<|Set<)/.test(t))
    return t.startsWith('Map<') ? 'new Map()' : t.startsWith('Set<') ? 'new Set()' : '{}';
  return 'undefined';
};

const closeOf = (text, open) => {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if ('([{<'.includes(text[i]) && !(text[i] === '<' && text[i - 1] === '=')) depth++;
    else if (')]}>'.includes(text[i]) && !(text[i] === '>' && text[i - 1] === '=')) depth--;
    if (depth === 0) return i;
  }
  return text.length;
};

export const stubOf = (source) => {
  const lines = [];
  for (const m of source.matchAll(
    /^export\s+(?:declare\s+)?(async\s+function|function|const|let|var)\s*\*?\s*([A-Za-z_$][\w$]*)/gm,
  )) {
    const [, kind, name] = m;
    const rest = source.slice(m.index + m[0].length);
    if (kind.endsWith('function')) {
      let i = rest.indexOf('(');
      if (rest[rest.search(/\S/)] === '<') i = rest.indexOf('(', closeOf(rest, rest.indexOf('<')));
      const after = rest.slice(closeOf(rest, i) + 1);
      const type = /^\s*:\s*([^{]+?)\s*\{/.exec(after)?.[1];
      lines.push(`export ${kind} ${name}() { return ${type ? emptyOfType(type) : '[]'}; }`);
      continue;
    }
    const init = /^[^=]*=\s*([\s\S]*)/.exec(rest)?.[1] ?? '';
    const declared = /^\s*:\s*([^=]+?)\s*=/.exec(rest)?.[1];
    if (/^(async\s+)?(\(|[\w$]+\s*=>|function)/.test(init) && !/^\(\s*\)\s*[^=]*\)/.test(init)) {
      lines.push(`export const ${name} = () => ${declared ? emptyOfType(declared) : '[]'};`);
    } else if (init.startsWith('[') || /\[\]$/.test(declared ?? '')) lines.push(`export const ${name} = [];`);
    else if (/^['"`]/.test(init) || declared?.trim() === 'string') lines.push(`export const ${name} = '';`);
    else lines.push(`export const ${name} = {};`);
  }
  return lines.join('\n') + '\n';
};

export const parseTap = (output) =>
  output
    .split('\n')
    .map((line) => /^\s*not ok \d+ - (.+?)(?: # .*)?$/.exec(line))
    .filter(Boolean)
    .map((m) => m[1])
    .filter((name) => !name.endsWith('.mjs'));

const runMjs = (checkout, specs) => {
  const failures = {};
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  for (const spec of specs) {
    const run = spawnSync('node', ['--test', '--test-reporter=tap', spec], { cwd: checkout, encoding: 'utf8', env });
    failures[spec] = parseTap(run.stdout);
    if (run.status !== 0 && failures[spec].length === 0) failures[spec] = [LOAD_ONLY];
  }
  return failures;
};

const runVitest = (checkout, specs) => {
  const failures = {};
  const byRoot = new Map();
  for (const spec of specs) {
    const root = owningRoot(checkout, spec);
    byRoot.set(root, [...(byRoot.get(root) ?? []), spec]);
  }
  for (const [root, group] of byRoot) {
    const outputFile = join(checkout, '.red-check-vitest.json');
    const run = spawnSync(
      'npx',
      [
        'vitest',
        'run',
        '--root',
        root,
        '--reporter=json',
        `--outputFile.json=${outputFile}`,
        ...group.map((s) => relative(root, s)),
      ],
      { cwd: checkout, encoding: 'utf8', maxBuffer: 1 << 28 },
    );
    try {
      const report = JSON.parse(readFileSync(outputFile, 'utf8'));
      for (const file of report.testResults) {
        const failed = file.assertionResults.filter((t) => t.status === 'failed').map((t) => t.fullName);
        const spec = group.find((s) => file.name.endsWith(relative(root, s))) ?? file.name;
        failures[spec] = failed.length === 0 && file.status === 'failed' ? [LOAD_ONLY] : failed;
      }
    } catch {
      for (const spec of group) failures[spec] = run.status === 0 ? [] : ['(vitest produced no report)'];
    }
  }
  return failures;
};

export const redCheck = (repo, commit, { dir } = {}) => {
  const files = changedFiles(repo, commit);
  const specs = files.filter((f) => isSpec(f.file) && f.status !== 'D').map((f) => f.file);
  if (specs.length === 0) return { ok: false, reason: 'the commit adds or changes no spec files', failures: {} };

  const sha = git(repo, 'rev-parse', commit);
  const parents = git(repo, 'rev-list', '--parents', '-n', '1', sha).split(' ').slice(1);
  const base = parents[0];
  const worktree = resolve(dir ?? mkdtempSync(join(tmpdir(), 'red-check-')));

  try {
    git(repo, 'worktree', 'add', '--detach', worktree, base ?? sha);
    const stubbed = [];
    for (const { status, file } of files) {
      if (isSpec(file) || status === 'D') continue;
      if (status === 'A') {
        if (/\.(ts|mjs)$/.test(file) && !file.endsWith('.d.ts')) {
          mkdirSync(dirname(join(worktree, file)), { recursive: true });
          writeFileSync(join(worktree, file), stubOf(git(repo, 'show', `${sha}:${file}`)));
          stubbed.push(file);
        } else rmSync(join(worktree, file), { force: true });
      } else git(worktree, 'checkout', base, '--', file);
    }
    git(worktree, 'checkout', sha, '--', ...specs);
    linkNodeModules(resolve(repo), worktree);

    const ts = specs.filter((s) => s.endsWith('.ts'));
    const mjs = specs.filter((s) => s.endsWith('.mjs'));
    const failures = { ...(ts.length ? runVitest(worktree, ts) : {}), ...(mjs.length ? runMjs(worktree, mjs) : {}) };
    const red = Object.values(failures).some((names) => names.some((n) => n !== LOAD_ONLY));
    return {
      ok: red,
      reason: red ? '' : 'no spec fails on an assertion at the parent state',
      failures,
      stubbed: stubbed.length > 0,
    };
  } finally {
    try {
      git(repo, 'worktree', 'remove', '--force', worktree);
    } catch {
      rmSync(worktree, { recursive: true, force: true });
      try {
        git(repo, 'worktree', 'prune');
      } catch {}
    }
  }
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const dirAt = args.indexOf('--dir');
  const dir = dirAt >= 0 ? args.splice(dirAt, 2)[1] : undefined;
  const commit = args[0];
  if (!commit) {
    console.error('usage: red-check.mjs <commit> [--dir <worktree dir>]');
    process.exit(2);
  }
  const repo = git(process.cwd(), 'rev-parse', '--show-toplevel');
  const result = redCheck(repo, commit, { dir });
  for (const [spec, names] of Object.entries(result.failures)) {
    const loadOnly = names.length > 0 && names.every((n) => n === LOAD_ONLY);
    console.log(
      `${spec}: ${names.length === 0 ? 'passes at the parent state' : loadOnly ? 'LOAD-ONLY (fails to load, not red)' : `${names.length} failing`}`,
    );
    if (loadOnly && result.stubbed) console.log('  auto stub failed, hand stub needed');
    else if (!loadOnly) for (const name of names) console.log(`  red: ${name}`);
  }
  console.log(result.ok ? 'RED: the specs fail without the commit' : `NOT RED: ${result.reason}`);
  process.exit(result.ok ? 0 : 1);
}
