import { existsSync, mkdirSync, readdirSync, readFileSync, rmdirSync, rmSync, writeFileSync } from 'fs';
import { dirname, join, relative } from 'path';
import { AgentTarget, loadConfig } from './config';
import { collectOwnedPaths } from './owned-paths';
import { buildPlan } from './plan';

export type RunOptions = {
  root: string;
  targets?: AgentTarget[];
  dryRun?: boolean;
};

type Change = {
  path: string;
  action: 'write' | 'update' | 'delete';
};

const readIfPresent = (absolute: string) => (existsSync(absolute) ? readFileSync(absolute, 'utf8') : null);

const diffPlan = (options: { root: string; files: { path: string; contents: string }[]; owned: string[] }) => {
  const { root, files, owned } = options;
  const planned = new Set(files.map((file) => file.path));
  const changes: Change[] = [];

  for (const file of files) {
    const current = readIfPresent(join(root, file.path));

    if (current === file.contents) continue;

    changes.push({ path: file.path, action: current === null ? 'write' : 'update' });
  }

  for (const path of owned) {
    if (!planned.has(path)) changes.push({ path, action: 'delete' });
  }

  return changes;
};

/** Removing the last generated file from a skill folder must not leave the folder behind. */
const pruneEmptyDirs = (options: { root: string; from: string }) => {
  let current = dirname(options.from);

  while (current.startsWith(options.root) && relative(options.root, current) !== '') {
    if (!existsSync(current) || readdirSync(current).length > 0) return;

    rmdirSync(current);
    current = dirname(current);
  }
};

const describe = (change: Change) => {
  const label = { write: 'create', update: 'update', delete: 'remove' }[change.action];

  return `  ${label} ${change.path}`;
};

export const sync = (options: RunOptions) => {
  const config = loadConfig({ root: options.root, targetOverride: options.targets });
  const { files, skipped, warnings } = buildPlan({ config });
  const changes = diffPlan({ root: options.root, files, owned: collectOwnedPaths(options.root) });

  console.log(`Targets: ${config.targets.join(', ')}`);

  for (const warning of warnings) {
    console.warn(`  warn   ${warning}`);
  }

  for (const entry of skipped) {
    console.log(`  skip   ${entry.name} — ${entry.reason}`);
  }

  if (changes.length === 0) {
    console.log('Everything is already up to date.');

    return 0;
  }

  changes.forEach((change) => console.log(describe(change)));

  if (options.dryRun) {
    console.log(`\n${changes.length} file(s) would change. Re-run without --dry-run to apply.`);

    return 0;
  }

  for (const file of files) {
    const absolute = join(options.root, file.path);

    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, file.contents, 'utf8');
  }

  for (const change of changes) {
    if (change.action !== 'delete') continue;

    const absolute = join(options.root, change.path);

    rmSync(absolute, { force: true });
    pruneEmptyDirs({ root: options.root, from: absolute });
  }

  console.log(`\n${changes.length} file(s) written.`);

  return 0;
};

export const check = (options: RunOptions) => {
  const config = loadConfig({ root: options.root, targetOverride: options.targets });
  const { files, warnings } = buildPlan({ config });
  const changes = diffPlan({ root: options.root, files, owned: collectOwnedPaths(options.root) });

  for (const warning of warnings) {
    console.warn(`  warn   ${warning}`);
  }

  if (changes.length === 0) {
    console.log('Agent rules are in sync.');

    return 0;
  }

  console.error('Agent rules are out of sync with @ethlete/agent-rules:');
  changes.forEach((change) => console.error(describe(change)));
  console.error('\nRun `npx ethlete-agents sync` and commit the result.');

  return 1;
};
