#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  jobIsPinned,
  jobMachine,
  machineHealth,
  machineOrder,
  MACHINES,
  remoteSuite,
  slotFile as slotFileOf,
  snapshotWorkingTree,
  tankIsLoaded,
} from './heavy-route.mjs';
import { localMachine, registerRun, teeRun } from './run-registry.mjs';
import { removeRunTmp, runTmpDir } from './tmp-sweep.mjs';

const prefix = process.env.HEAVY_LOCK_PREFIX ?? '/tmp/fifagg-heavy';
const slotCount = Number(process.env.HEAVY_SLOTS ?? MACHINES.tank.slots);
const pollMs = Number(process.env.HEAVY_POLL_MS ?? 500);
const remoteRunScript = process.env.HEAVY_REMOTE_RUN ?? join(dirname(fileURLToPath(import.meta.url)), 'remote-run.mjs');
const busyExit = 200;
const forwarded = ['SIGINT', 'SIGTERM', 'SIGHUP'];
const signalNumber = { SIGHUP: 1, SIGINT: 2, SIGKILL: 9, SIGTERM: 15 };
const usage =
  'usage: heavy.mjs run [--on tank|rack|mac] [--movable] [--fetch <path>]... [--env <name>]... [--forward <port>]... [--yarn-cache] -- <command>';

const slotFile = (machine, n) => slotFileOf(machine, n, prefix);

const slotName = (machine, n) => (machine === 'tank' ? `slot ${n}` : `${machine} slot ${n}`);

const describeHolder = (machine, n) => {
  try {
    const info = JSON.parse(readFileSync(`${slotFile(machine, n)}.info`, 'utf8'));
    if (existsSync(`/proc/${info.pid}`)) {
      const age = Math.round((Date.now() - info.startedAt) / 1000);
      return `${slotName(machine, n)}: pid ${info.pid}, cwd ${info.cwd}, age ${age}s, ${info.command}`;
    }
  } catch {
    // no info file: the holder is a bare flock caller
  }
  return `${slotName(machine, n)}: held by a bare flock caller (no info)`;
};

const tryRun = (argv, { label, machine, n, run, cwd, env = process.env, onStart }) => {
  const info = JSON.stringify({ cwd: process.cwd(), command: label, startedAt: Date.now() });
  const script =
    'printf \'{"pid":%s,%s\' "$$" "${HEAVY_INFO#\\{}" > "$1"; printf \'[heavy] %s\\n\' "$2" >> "$3"; printf x >&3; exec 3>&-; shift 3; exec "$@"';
  let child;
  const forward = (signal) => child?.kill(signal);
  for (const s of forwarded) process.on(s, forward);
  return teeRun(run, argv, {
    wrap: (command) => [
      'flock',
      '-n',
      '-E',
      String(busyExit),
      slotFile(machine, n),
      'sh',
      '-c',
      script,
      'sh',
      `${slotFile(machine, n)}.info`,
      slotName(machine, n),
      run.log,
      ...command,
    ],
    env: { ...env, HEAVY_INFO: info },
    cwd,
    onSpawn: (spawned) => (child = spawned),
    onFd3: onStart,
  }).then(({ code, signal }) => {
    for (const s of forwarded) process.off(s, forward);
    return signal ? 128 + (signalNumber[signal] ?? 0) : code;
  });
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const usableRemote = (machine) => {
  const health = machineHealth(machine);
  if (!health.usable) console.error(`heavy: ${machine} ${health.reason}, skipping it`);
  return health.usable;
};

const runMachines = (command, wanted, remoteOpts) => {
  const preferred = wanted ?? (process.env.HEAVY_ROUTE === 'off' ? 'tank' : jobMachine(command));
  const movable =
    !wanted &&
    process.env.HEAVY_ROUTE !== 'off' &&
    !jobIsPinned(command) &&
    (preferred !== 'tank' || remoteOpts.movable || remoteOpts.fetch.length > 0);
  let loaded = false;
  const order = machineOrder({
    preferred,
    movable,
    tankLoaded: () => (loaded = tankIsLoaded()),
    usable: usableRemote,
  });
  if (loaded && order.length > 1) console.error(`heavy: tank is loaded, trying ${order.join(', ')}`);
  return order;
};

const remoteTarget = () => {
  const snapshot = snapshotWorkingTree();
  if (!snapshot) console.error('heavy: no git repo here, running on tank');
  return snapshot;
};

const remoteArgv = (target, suite, n, { fetch, env, forward, yarnCache }) => [
  process.execPath,
  remoteRunScript,
  '--host',
  target.machine,
  ...(MACHINES[target.machine].linux ? ['--linux'] : []),
  '--ref',
  target.sha,
  '--slot',
  `heavy-${target.repo}-${n}`,
  ...fetch.flatMap((path) => ['--fetch', path]),
  ...env.flatMap((name) => ['--env', name]),
  ...forward.flatMap((port) => ['--forward', port]),
  ...(yarnCache && target.machine === 'rack' ? ['--yarn-cache'] : []),
  '--',
  suite,
];

const run = async (command, wanted, remoteOpts) => {
  const label = command.join(' ');
  const tankName = localMachine();
  const machines = runMachines(command, wanted, remoteOpts);
  const snapshot = machines.length > 1 ? remoteTarget() : undefined;
  const remotes = snapshot ? machines.filter((machine) => machine !== 'tank') : [];
  const entry = registerRun({ machine: remotes[0] ?? tankName, label: `heavy ${label}`, command: label });
  const runTmp = runTmpDir();
  const env = { ...process.env, TMPDIR: runTmp };
  const attempts = [
    ...remotes.flatMap((machine) =>
      Array.from({ length: MACHINES[machine].slots }, (_, i) => ({
        machine,
        n: i + 1,
        argv: remoteArgv({ machine, ...snapshot }, remoteSuite(command, snapshot.rel), i + 1, remoteOpts),
        cwd: snapshot.top,
        env: { ...process.env, REMOTE_RUN_NO_REGISTRY: '1' },
      })),
    ),
    ...Array.from({ length: slotCount }, (_, i) => ({ machine: 'tank', n: i + 1, argv: command, env })),
  ];
  let reported = false;
  try {
    for (;;) {
      for (const attempt of attempts) {
        const code = await tryRun(attempt.argv, {
          ...attempt,
          label,
          run: entry,
          onStart: () => {
            const machine = attempt.machine === 'tank' ? tankName : attempt.machine;
            if (machine !== entry.machine) entry.update({ machine });
            if (remotes.length && attempt.machine === 'tank')
              console.error(`heavy: ${remotes.join(', ')} slots are taken, running on tank`);
          },
        });
        if (code !== busyExit) {
          entry.finish(code);
          return code;
        }
      }
      if (!reported) {
        reported = true;
        console.error(`heavy: all ${attempts.length} slots are taken:`);
        for (const { machine, n } of attempts) console.error(`  ${describeHolder(machine, n)}`);
      }
      await sleep(pollMs);
    }
  } finally {
    if (!removeRunTmp(runTmp)) console.error(`heavy: ${runTmp} is still in use, the tmp sweep removes it later`);
  }
};

const [verb, ...rest] = process.argv.slice(2);
const sep = rest.indexOf('--');
const command = sep === -1 ? rest : rest.slice(sep + 1);
const own = sep === -1 ? [] : rest.slice(0, sep);
let wantedMachine;
const remoteOpts = { fetch: [], env: [], forward: [] };
let bad = false;
for (let i = 0; i < own.length; i += 2) {
  if (own[i] === '--yarn-cache' || own[i] === '--movable') {
    remoteOpts[own[i] === '--movable' ? 'movable' : 'yarnCache'] = true;
    i--;
    continue;
  }
  const key = own[i].replace(/^--/, '');
  if (own[i] === '--on' && own[i + 1]) wantedMachine = own[i + 1];
  else if (own[i] !== `--${key}` || !Array.isArray(remoteOpts[key]) || !own[i + 1] || own[i + 1].startsWith('--'))
    bad = true;
  else remoteOpts[key].push(own[i + 1]);
}
const wanted = wantedMachine ?? process.env.HEAVY_MACHINE;
if (verb !== 'run' || command.length === 0 || bad || (wanted && !MACHINES[wanted])) {
  console.error(usage);
  process.exit(2);
}
process.exit(await run(command, wanted, remoteOpts));
