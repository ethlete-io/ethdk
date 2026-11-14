import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { linkSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cliBuildMarkOf, dirtyCliNoteOf, ensureCliCopy, workingTreeCliCopy } from './studio-code.mjs';

const BACKSTOP_MS = { shot: 6 * 60_000, check: 22 * 60_000 };
const DEADLINE_EXIT_CODE = 124;
const PARENT_POLL_MS = 1500;
const KILL_GRACE_MS = 5000;
const FORWARDED = ['SIGTERM', 'SIGINT', 'SIGHUP'];

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const WORKING_TREE = '--working-tree';
const workingTree = process.argv.slice(2).includes(WORKING_TREE);
const args = process.argv.slice(2).filter((arg) => arg !== WORKING_TREE);

if (workingTree && process.env.ETHLETE_DESIGN_CLI_ENTRY) {
  console.error(`et-design: ${WORKING_TREE} builds its own CLI; unset ETHLETE_DESIGN_CLI_ENTRY or drop the option.`);
  process.exit(2);
}

if (
  !process.env.ETHLETE_DESIGN_CLI_ENTRY &&
  spawnSync('git', ['rev-parse', '--git-dir'], { cwd: root, stdio: 'ignore' }).status !== 0
) {
  console.error(
    `et-design: ${root} is no git checkout, and the CLI copy needs git. In a scratch copy run \`npx nx build cli\`, then \`node dist/libs/cli/src/index.js design ...\`.`,
  );
  process.exit(2);
}
const stateDir = process.env.ETHLETE_DESIGN_STATE_DIR || join(tmpdir(), 'et-design');

const alive = (pid) => {
  try {
    process.kill(pid, 0);

    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
};

const ppidOf = (parent) => {
  try {
    const stat = readFileSync('/proc/self/stat', 'utf8');

    return Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[1]);
  } catch {
    return alive(parent) ? parent : 1;
  }
};

const heldOf = (file) => {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
};

const lock = () => {
  const key = createHash('sha1')
    .update(JSON.stringify([root, args]))
    .digest('hex')
    .slice(0, 16);
  const file = join(stateDir, 'locks', `${key}.json`);
  const draft = `${file}.${process.pid}`;

  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(draft, JSON.stringify({ pid: process.pid, args, started: new Date().toISOString() }));

  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        linkSync(draft, file);
        process.on('exit', () => heldOf(file)?.pid === process.pid && rmSync(file, { force: true }));

        return null;
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;

        const held = heldOf(file);

        if (held && alive(held.pid)) return held;

        rmSync(file, { force: true });
      }
    }

    return heldOf(file) ?? { pid: 'unknown' };
  } finally {
    rmSync(draft, { force: true });
  }
};

const held = lock();

if (held) {
  console.error(
    `et-design: \`design ${args.join(' ')}\` already runs as pid ${held.pid} (since ${held.started}). Wait for it, or end it with \`kill ${held.pid}\`.`,
  );
  process.exit(1);
}

const { entry, mark } = (() => {
  if (process.env.ETHLETE_DESIGN_CLI_ENTRY) return { entry: process.env.ETHLETE_DESIGN_CLI_ENTRY, mark: 'custom' };

  if (workingTree) {
    const copy = workingTreeCliCopy(root);

    process.on('exit', () => rmSync(copy.dir, { recursive: true, force: true }));
    console.error(`et:design runs the cli built from the working tree (${copy.mark}) in ${copy.dir}`);

    return copy;
  }

  const { entry, sha, dirty } = ensureCliCopy(root, { keepWhenDirty: false });
  const note = dirtyCliNoteOf({ sha, dirty, args });

  if (note) console.error(note);

  return { entry, mark: cliBuildMarkOf({ sha, dirty: false }) };
})();

// `et design` reads stdin, and a detached child reading the terminal from a background group stops on SIGTTIN.
const detached = !process.stdin.isTTY;
const child = spawn(process.execPath, [entry, 'design', ...args], {
  stdio: 'inherit',
  detached,
  env: { ...process.env, ETHLETE_DESIGN_CLI_BUILD: mark },
});
const group = detached ? -child.pid : child.pid;
const signal = (name) => {
  try {
    process.kill(group, name);
  } catch {
    return;
  }
};

let ending = null;

const end = (name, reason) => {
  if (ending) return;

  ending = reason;
  signal(name);
  setTimeout(() => signal('SIGKILL'), KILL_GRACE_MS).unref();
};

for (const name of FORWARDED) process.on(name, () => end(name, name));

const parent = process.ppid;

if (parent > 1) setInterval(() => ppidOf(parent) !== parent && end('SIGTERM', 'parent gone'), PARENT_POLL_MS).unref();

const forced = Number(process.env.ETHLETE_DESIGN_DEADLINE_MS);
const backstopMs = forced > 0 ? Math.ceil(forced * 1.1) + 1000 : BACKSTOP_MS[args[0]];

if (backstopMs)
  setTimeout(() => {
    const tree = spawnSync('ps', ['-o', 'pid,ppid,etime,args', '-g', String(child.pid)], { encoding: 'utf8' }).stdout;
    const file = join(
      stateDir,
      'deadline',
      `wrapper-${args[0]}-${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}.log`,
    );

    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(
      file,
      [
        `design ${args.join(' ')} did not end within ${Math.round(backstopMs / 1000)} s, past its own deadline; ended its process group`,
        `wrapper pid ${process.pid}, cli pid ${child.pid}, ended ${new Date().toISOString()}`,
        'process group:',
        tree || '(ps found nothing)',
      ].join('\n') + '\n',
    );
    console.error(`et-design: \`design ${args[0]}\` passed its deadline; log: ${file}`);
    end('SIGTERM', 'deadline');
  }, backstopMs).unref();

child.on('exit', (code) => {
  if (ending && detached) signal('SIGKILL');

  process.exit(ending === 'deadline' ? DEADLINE_EXIT_CODE : (code ?? 1));
});
