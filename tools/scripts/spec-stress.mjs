import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_MARKERS = ['project.json', 'vitest.config.mts', 'vitest.config.ts', 'vite.config.mts', 'vite.config.ts'];

export const parseArgs = (argv) => {
  const options = { specs: [], runs: 8, load: 0, slow: 0 };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--slow') {
      const value = Number(argv[++i]);
      if (!(value > 1)) throw new Error('--slow needs a factor above 1');
      options.slow = value;
    } else if (arg === '--runs' || arg === '--load') {
      const value = Number(argv[++i]);
      if (!Number.isInteger(value) || value < (arg === '--runs' ? 1 : 0)) throw new Error(`${arg} needs an integer`);
      options[arg.slice(2)] = value;
    } else if (arg.startsWith('--')) throw new Error(`unknown option ${arg}`);
    else options.specs.push(arg);
  }
  if (!options.specs.length) throw new Error('give at least one spec file');
  return options;
};

export const summarize = (results) => {
  const bySpec = new Map();
  for (const { spec, ok } of results) {
    const entry = bySpec.get(spec) ?? { spec, runs: 0, failed: 0 };
    entry.runs++;
    if (!ok) entry.failed++;
    bySpec.set(spec, entry);
  }
  const specs = [...bySpec.values()];
  return {
    specs,
    flaky: specs.filter((s) => s.failed > 0 && s.failed < s.runs),
    broken: specs.filter((s) => s.failed === s.runs),
    ok: specs.every((s) => s.failed === 0),
  };
};

const owningRoot = (repo, spec) => {
  let dir = dirname(spec);
  while (dir !== '.') {
    if (ROOT_MARKERS.some((n) => existsSync(join(repo, dir, n)))) return dir;
    dir = dirname(dir);
  }
  return '.';
};

const commandFor = (repo, spec) => {
  if (spec.endsWith('.mjs')) return ['node', ['--test', spec]];
  const root = owningRoot(repo, spec);
  const perfConfig = 'vitest.perf.config.mts';
  const config =
    /\.perf\.spec\.[cm]?ts$/.test(spec) && existsSync(join(repo, root, perfConfig)) ? ['--config', perfConfig] : [];
  return ['npx', ['vitest', 'run', '--root', root, ...config, '--maxWorkers=1', relative(root, spec)]];
};

export const cpuQuotaOf = (slow) => `${Math.max(1, Math.round(100 / slow))}%`;

export const slowed = ([cmd, args], slow) =>
  slow
    ? ['systemd-run', ['--user', '--scope', '--quiet', '-p', `CPUQuota=${cpuQuotaOf(slow)}`, cmd, ...args]]
    : [cmd, args];

const runOnce = (repo, spec, slow) =>
  new Promise((resolve) => {
    const [cmd, args] = slowed(commandFor(repo, spec), slow);
    const child = spawn(cmd, args, { cwd: repo, stdio: 'ignore' });
    child.on('exit', (code) => resolve({ spec, ok: code === 0 }));
    child.on('error', () => resolve({ spec, ok: false }));
  });

const burn = (count) => {
  const busy = 'const e=Date.now()+6e5;while(Date.now()<e);';
  return Array.from({ length: count }, () => spawn(process.execPath, ['-e', busy], { stdio: 'ignore' }));
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  const repo = process.cwd();
  if (options.slow && spawnSync('systemd-run', ['--user', '--scope', '--quiet', 'true']).status !== 0) {
    console.error('--slow needs systemd-run --user (a Linux user session with systemd)');
    process.exit(2);
  }
  const hogs = burn(options.load || (options.slow ? 0 : cpus().length));
  const jobs = options.specs.flatMap((spec) => Array.from({ length: options.runs }, () => spec));
  let results;
  try {
    results = await Promise.all(jobs.map((spec) => runOnce(repo, spec, options.slow)));
  } finally {
    for (const hog of hogs) hog.kill();
  }
  const summary = summarize(results);
  for (const s of summary.specs) {
    console.log(`${s.failed ? 'FAIL' : 'ok  '} ${s.spec}: ${s.runs - s.failed}/${s.runs} passed`);
  }
  if (summary.flaky.length) console.log(`flaky: ${summary.flaky.map((s) => s.spec).join(', ')}`);
  process.exit(summary.ok ? 0 : 1);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
