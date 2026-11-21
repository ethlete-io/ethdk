import { execFileSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const OWN_SCOPE_ENV = 'ETHLETE_OWN_SCOPE';

export const OWN_SCOPE_LIMITS = {
  'studio-e2e': { memoryHigh: '32G', memoryMax: '40G' },
  'storybook-e2e': { memoryHigh: '12G', memoryMax: '16G' },
  'push-suite': { memoryHigh: '24G', memoryMax: '32G' },
};

const UNITS = { K: 1024, M: 1024 ** 2, G: 1024 ** 3 };

export const bytesOf = (size) => {
  const match = /^(\d+)([KMG])?$/i.exec(String(size).trim());
  if (!match) throw new Error(`own-scope: not a size: ${size}`);
  return String(Number(match[1]) * (match[2] ? UNITS[match[2].toUpperCase()] : 1));
};

export const scopeUnitOf = (name, pid) => `${name.replace(/[^A-Za-z0-9_-]/g, '-')}-${pid}.scope`;

const cgroupOf = (readCgroup) =>
  readCgroup()
    .split('\n')
    .find((line) => line.startsWith('0::')) ?? '';

export const inOwnScope = (env = process.env, readCgroup = () => readFileSync('/proc/self/cgroup', 'utf8')) => {
  const unit = env[OWN_SCOPE_ENV];
  if (!unit) return false;
  try {
    return `${cgroupOf(readCgroup)}/`.includes(`/${unit}/`);
  } catch {
    return false;
  }
};

export const startTransientScopeArgs = (unit, pid, { memoryHigh, memoryMax, preference }) => {
  const props = [
    ['Description', 's', `ethlete heavy job ${unit}`],
    ['PIDs', 'au', '1', String(pid)],
    ['MemoryHigh', 't', bytesOf(memoryHigh)],
    ['MemoryMax', 't', bytesOf(memoryMax)],
    ['MemorySwapMax', 't', '0'],
    ['OOMPolicy', 's', 'kill'],
    ['CollectMode', 's', 'inactive-or-failed'],
    ...(preference ? [['ManagedOOMPreference', 's', preference]] : []),
  ];
  return [
    '--user',
    'call',
    'org.freedesktop.systemd1',
    '/org/freedesktop/systemd1',
    'org.freedesktop.systemd1.Manager',
    'StartTransientUnit',
    'ssa(sv)a(sa(sv))',
    unit,
    'fail',
    String(props.length),
    ...props.flat(),
    '0',
  ];
};

const pause = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/**
 * Moves this process into its own transient systemd user scope with the job's memory limits, so the kernel or
 * systemd-oomd kills the job and never the agent session that started it. Call it before the job starts a child: only
 * later children inherit the scope. A no-op off Linux, without a systemd user manager, and inside a scoped job.
 */
export const enterOwnScope = (
  name,
  {
    limits = OWN_SCOPE_LIMITS[name],
    env = process.env,
    platform = process.platform,
    pid = process.pid,
    busctl = (args) => execFileSync('busctl', args, { stdio: ['ignore', 'pipe', 'pipe'], timeout: 10_000 }),
    readCgroup = () => readFileSync(`/proc/${pid}/cgroup`, 'utf8'),
    log = (line) => process.stderr.write(`${line}\n`),
  } = {},
) => {
  if (!limits) throw new Error(`own-scope: no limits for ${name}`);
  if (platform !== 'linux') return { ok: false, reason: 'not linux' };
  if (inOwnScope(env, readCgroup)) return { ok: true, unit: env[OWN_SCOPE_ENV], inherited: true };
  const unit = scopeUnitOf(name, pid);
  try {
    busctl(startTransientScopeArgs(unit, pid, limits));
  } catch (error) {
    const reason = String(error.stderr || error.message)
      .trim()
      .split('\n')[0];
    log(`[own-scope] ${name} runs in the caller's cgroup, no systemd user scope: ${reason}`);
    return { ok: false, reason };
  }
  for (let tries = 0; tries < 100 && !cgroupOf(readCgroup).endsWith(`/${unit}`); tries++) pause(20);
  if (!cgroupOf(readCgroup).endsWith(`/${unit}`)) {
    log(`[own-scope] ${name}: ${unit} started but this process did not move into it`);
    return { ok: false, reason: 'not moved' };
  }
  env[OWN_SCOPE_ENV] = unit;
  return { ok: true, unit, inherited: false };
};

export const parseOwnScopeArgs = (argv) => {
  const split = argv.indexOf('--');
  if (split < 1 || split === argv.length - 1) return undefined;
  const flags = argv.slice(1, split);
  const valueOf = (flag) => (flags.includes(flag) ? flags[flags.indexOf(flag) + 1] : undefined);
  const name = argv[0];
  const base = OWN_SCOPE_LIMITS[name];
  const memoryMax = valueOf('--memory-max') ?? base?.memoryMax;
  const memoryHigh = valueOf('--memory-high') ?? base?.memoryHigh ?? memoryMax;
  if (!memoryMax) return undefined;
  return { name, limits: { memoryHigh, memoryMax }, command: argv.slice(split + 1) };
};

const main = () => {
  const parsed = parseOwnScopeArgs(process.argv.slice(2));
  if (!parsed) {
    console.error(
      `usage: own-scope.mjs <${Object.keys(OWN_SCOPE_LIMITS).join('|')}|name --memory-max <size>> [--memory-high <size>] -- <command> [args...]`,
    );
    process.exit(2);
  }
  const { name, limits, command } = parsed;
  const entered = enterOwnScope(name, { limits });
  if (entered.ok) console.error(`[own-scope] ${name} runs in ${entered.unit}`);
  const child = spawn(command[0], command.slice(1), { stdio: 'inherit' });
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => child.kill(signal));
  child.on('error', (error) => {
    console.error(`${name}: ${error.message}`);
    process.exit(1);
  });
  child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
};

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
