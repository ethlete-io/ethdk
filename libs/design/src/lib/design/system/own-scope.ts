import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';

/** Must match OWN_SCOPE_ENV in tools/scripts/own-scope.mjs: a design server inside a scoped e2e run stays in its scope. */
export const OWN_SCOPE_ENV = 'ETHLETE_OWN_SCOPE';

export const DESIGN_SERVER_LIMITS = { memoryHigh: 8 * 1024 ** 3, memoryMax: 12 * 1024 ** 3 };

type OwnScopeDeps = {
  env: NodeJS.ProcessEnv;
  platform: NodeJS.Platform;
  pid: number;
  busctl: (args: string[]) => void;
  readCgroup: () => string;
  log: (line: string) => void;
};

const realDeps = (): OwnScopeDeps => ({
  env: process.env,
  platform: process.platform,
  pid: process.pid,
  busctl: (args) => void execFileSync('busctl', args, { stdio: ['ignore', 'pipe', 'pipe'], timeout: 10_000 }),
  readCgroup: () => readFileSync(`/proc/${process.pid}/cgroup`, 'utf8'),
  log: (line) => void process.stderr.write(`${line}\n`),
});

const cgroupOf = (deps: OwnScopeDeps) =>
  deps
    .readCgroup()
    .split('\n')
    .find((line) => line.startsWith('0::')) ?? '';

const pause = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

export const designServerScopeArgs = (unit: string, pid: number) => [
  '--user',
  'call',
  'org.freedesktop.systemd1',
  '/org/freedesktop/systemd1',
  'org.freedesktop.systemd1.Manager',
  'StartTransientUnit',
  'ssa(sv)a(sa(sv))',
  unit,
  'fail',
  '7',
  'Description',
  's',
  `ethlete heavy job ${unit}`,
  'PIDs',
  'au',
  '1',
  String(pid),
  'MemoryHigh',
  't',
  String(DESIGN_SERVER_LIMITS.memoryHigh),
  'MemoryMax',
  't',
  String(DESIGN_SERVER_LIMITS.memoryMax),
  'MemorySwapMax',
  't',
  '0',
  'OOMPolicy',
  's',
  'kill',
  'CollectMode',
  's',
  'inactive-or-failed',
  '0',
];

/** Call before the server starts a child: only later children inherit the scope. */
export const enterDesignServerScope = (deps: OwnScopeDeps = realDeps()): string | null => {
  if (deps.platform !== 'linux') return null;

  const inherited = deps.env[OWN_SCOPE_ENV];

  try {
    if (inherited && `${cgroupOf(deps)}/`.includes(`/${inherited}/`)) return inherited;
  } catch {
    return null;
  }

  const unit = `design-server-${deps.pid}.scope`;

  try {
    deps.busctl(designServerScopeArgs(unit, deps.pid));
  } catch (error) {
    const stderr = (error as { stderr?: Buffer | string }).stderr;

    deps.log(`design server runs in the caller's cgroup, no systemd user scope: ${String(stderr || error).trim()}`);

    return null;
  }

  for (let tries = 0; tries < 100 && !cgroupOf(deps).endsWith(`/${unit}`); tries++) pause(20);

  if (!cgroupOf(deps).endsWith(`/${unit}`)) return null;

  deps.env[OWN_SCOPE_ENV] = unit;

  return unit;
};
