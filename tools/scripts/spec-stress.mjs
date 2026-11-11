import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_MARKERS = ['project.json', 'vitest.config.mts', 'vitest.config.ts', 'vite.config.mts', 'vite.config.ts'];

export const parseArgs = (argv) => {
  const options = { specs: [], runs: 8, load: 0, slow: 0, jobs: 0, github: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--github') options.github = true;
    else if (arg === '--jobs') {
      const value = Number(argv[++i]);
      if (!Number.isInteger(value) || value < 1) throw new Error('--jobs needs an integer above 0');
      options.jobs = value;
    } else if (arg === '--slow') {
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
  for (const { spec, ok, ms = 0, output = '' } of results) {
    const entry = bySpec.get(spec) ?? { spec, runs: 0, failed: 0, maxMs: 0, firstFailure: undefined };
    entry.runs++;
    if (!ok) {
      entry.failed++;
      entry.firstFailure ??= output;
    }
    entry.maxMs = Math.max(entry.maxMs, ms);
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

export const OUTPUT_TAIL_BYTES = 64 * 1024;

export const tailOf = (text, limit = OUTPUT_TAIL_BYTES) =>
  text.length > limit ? `[... ${text.length - limit} earlier characters cut]\n${text.slice(-limit)}` : text;

const runOnce = (repo, spec, slow) =>
  new Promise((resolve) => {
    const [cmd, args] = slowed(commandFor(repo, spec), slow);
    const started = Date.now();
    let output = '';
    const keep = (chunk) => {
      output = (output + chunk).slice(-2 * OUTPUT_TAIL_BYTES);
    };
    const child = spawn(cmd, args, { cwd: repo, stdio: ['ignore', 'pipe', 'pipe'] });
    for (const stream of [child.stdout, child.stderr]) stream.setEncoding('utf8').on('data', keep);
    child.on('close', (code) => resolve({ spec, ok: code === 0, ms: Date.now() - started, output: tailOf(output) }));
    child.on('error', (error) => resolve({ spec, ok: false, ms: Date.now() - started, output: String(error) }));
  });

export const runPooled = async (jobs, limit, run) => {
  const results = new Array(jobs.length);
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const index = next++;
      results[index] = await run(jobs[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit || jobs.length, jobs.length) }, worker));
  return results;
};

export const reportLines = (summary, { slow, github }) =>
  summary.specs.flatMap((s) => {
    const passed = `${s.runs - s.failed}/${s.runs} passed`;
    const line = `${s.failed ? 'FAIL' : 'ok  '} ${s.spec}: ${passed}, slowest ${(s.maxMs / 1000).toFixed(1)} s`;
    if (!github || !s.failed) return [line];
    const under = slow ? ` under --slow ${slow}` : '';
    return [
      line,
      `::error file=${s.spec},title=spec:stress::${s.spec} ${passed}${under}`,
      `::group::${s.spec}: output of the first failed run`,
      ...(s.firstFailure || '(the run printed nothing)').trimEnd().split('\n'),
      '::endgroup::',
    ];
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
    results = await runPooled(jobs, options.jobs, (spec) => runOnce(repo, spec, options.slow));
  } finally {
    for (const hog of hogs) hog.kill();
  }
  const summary = summarize(results);
  for (const line of reportLines(summary, options)) console.log(line);
  if (summary.flaky.length) console.log(`flaky: ${summary.flaky.map((s) => s.spec).join(', ')}`);
  process.exit(summary.ok ? 0 : 1);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
