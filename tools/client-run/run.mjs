#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { writeImageSet } from './image-set.mjs';

const USAGE = `usage: yarn client-run [--source <tomflix>] [--out <dir>] [--sdk <built sdk copy>] [--titles <n>] [--model <m>]
       yarn client-run --judge <run dir> [--sdk <built sdk copy>]     judge an earlier run again, with that sdk's cli`;

const here = import.meta.dirname;
const repo = resolve(here, '../..');
const cleanSlate = join(repo, 'tools/scripts/clean-slate-run');
const KEEP = ['apps/api', 'libs/env', 'libs/queries', 'libs/types', 'test', 'tools', '.codex'];

const { values } = parseArgs({
  options: {
    source: { type: 'string', default: join(homedir(), 'dev/tomflix') },
    catalog: { type: 'string' },
    out: { type: 'string', default: join(homedir(), 'dev/client-runs') },
    sdk: { type: 'string' },
    titles: { type: 'string', default: '12' },
    model: { type: 'string' },
    judge: { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  },
});
if (values.help) {
  console.log(USAGE);
  process.exit(0);
}

const run = (command, args, options = {}) => {
  console.log(`client-run: ${command} ${args.join(' ')}`.slice(0, 300));
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.status !== 0) {
    console.error(`client-run: ${command} exited ${result.status}`);
    process.exit(1);
  }
};

const stampOf = (date) => {
  const two = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}-${two(date.getHours())}${two(date.getMinutes())}`;
};

const buildSdk = (dir) => {
  run('node', [join(repo, 'tools/scripts/scratch-checkout.mjs'), dir]);
  run('npx', ['nx', 'run-many', '-t', 'build', '-p', 'cli', 'agent-rules', '--outputStyle=static'], {
    cwd: dir,
    env: { ...process.env, NX_NO_CLOUD: 'true', NX_DAEMON: 'false' },
  });
  return dir;
};

const runAgent = ({ runDir, target, model }) => {
  const order = readFileSync(join(here, 'order.md'), 'utf8');
  const claude = [
    'claude',
    '-p',
    order,
    '--output-format',
    'stream-json',
    '--verbose',
    '--dangerously-skip-permissions',
  ];
  if (model) claude.push('--model', model);
  const transcript = join(runDir, 'transcript.jsonl');
  console.log(`client-run: the agent runs in the sandbox, transcript ${transcript}`);
  const out = openSync(transcript, 'w');
  const result = spawnSync(join(cleanSlate, 'sandbox.sh'), [target, '--', ...claude], {
    stdio: ['ignore', out, 'inherit'],
    env: { ...process.env, PATH: `${dirname(process.execPath)}:${process.env.PATH}` },
  });
  closeSync(out);
  return result.status;
};

const expected = JSON.parse(readFileSync(join(here, 'expect.json'), 'utf8'));
const judge = async (options) => (await import('./judge.mjs')).judgeRun({ expected, ...options });

if (values.judge) {
  const runDir = resolve(values.judge);
  await judge({ runDir, target: join(runDir, 'tomflix'), sdk: values.sdk && resolve(values.sdk) });
  process.exit(0);
}

const stamp = stampOf(new Date());
const runDir = join(resolve(values.out), stamp);
const target = join(runDir, 'tomflix');
if (existsSync(runDir)) {
  console.error(`client-run: ${runDir} exists`);
  process.exit(1);
}
mkdirSync(runDir, { recursive: true });

const sdk = values.sdk
  ? resolve(values.sdk)
  : buildSdk(join(homedir(), '.cache/ethlete-scratch', `client-run-sdk-${stamp}`));
run('bash', [
  join(cleanSlate, 'make-copy.sh'),
  resolve(values.source),
  target,
  '--keep',
  ...KEEP,
  '--overlay',
  join(cleanSlate, 'overlays/tomflix'),
  '--sdk',
  sdk,
]);

const entries = writeImageSet({
  catalog: values.catalog ? resolve(values.catalog) : join(resolve(values.source), '.dev/srv'),
  out: join(`${target}-home`, 'bilder-von-tom'),
  count: Number(values.titles),
});
console.log(`client-run: image set of ${entries.length} titles, ${entries.filter((e) => !e.logo).length} without logo`);

const status = runAgent({ runDir, target, model: values.model });
console.log(`client-run: agent exited ${status}`);
await judge({ runDir, target });
if (!values.sdk) run('node', [join(repo, 'tools/scripts/scratch-checkout.mjs'), '--remove', sdk]);
