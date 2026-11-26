import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const usage =
  'Usage: yarn untrack -m "<commit message>" <path>...\nCommits the removal of each path from git and keeps the file on disk.';

const parseArgs = (argv) => {
  const paths = [];
  let message;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') return { help: true };
    if (arg === '-m' || arg === '--message') message = argv[++i];
    else if (arg === '--') {
      paths.push(...argv.slice(i + 1));
      break;
    } else if (arg.startsWith('-')) throw new Error(`untrack: unknown argument ${arg}`);
    else paths.push(arg);
  }
  if (!message) throw new Error('untrack: -m "<commit message>" is missing');
  if (!paths.length) throw new Error('untrack: no path given');
  return { message, paths };
};

const git = (args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
const hashOf = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');

const untrack = ({ message, paths }) => {
  for (const path of paths) {
    if (!git(['ls-files', '--', path]).trim()) throw new Error(`untrack: ${path} is not tracked`);
    if (!existsSync(path)) throw new Error(`untrack: ${path} does not exist on disk`);
  }
  const parked = mkdtempSync(join(tmpdir(), 'untrack-'));
  const moved = paths.map((path, index) => ({ path, hash: hashOf(path), parkedAt: join(parked, String(index)) }));
  try {
    for (const file of moved) renameSync(file.path, file.parkedAt);
    execFileSync('git', ['commit', '-q', '-m', message, '--', ...paths], { stdio: 'inherit' });
  } finally {
    for (const file of moved) if (existsSync(file.parkedAt)) renameSync(file.parkedAt, file.path);
    rmSync(parked, { recursive: true, force: true });
  }
  for (const file of moved) {
    if (hashOf(file.path) !== file.hash) throw new Error(`untrack: ${file.path} changed on disk`);
    console.log(`untracked ${file.path}`);
  }
};

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) console.log(usage);
  else untrack(args);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
