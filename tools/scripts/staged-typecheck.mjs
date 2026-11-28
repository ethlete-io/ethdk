#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '../..');
const PARENTS = ['apps', 'libs'];
const SOURCE = /\.(ts|tsx|json)$/;

export const typecheckCommands = (files, read, exists) => {
  const commands = new Map();
  for (const file of files) {
    const [parent, name] = file.split('/');
    if (!PARENTS.includes(parent) || name === undefined || !SOURCE.test(file)) continue;
    const projectFile = `${parent}/${name}/project.json`;
    if (commands.has(projectFile) || !exists(projectFile)) continue;
    const project = JSON.parse(read(projectFile));
    const command = project.targets?.typecheck?.options?.command;
    if (command) commands.set(projectFile, { name: project.name, command });
  }
  return [...commands.values()].sort((a, b) => a.name.localeCompare(b.name));
};

export const linkNodeModules = (from, to) => {
  for (const parent of ['', ...PARENTS])
    for (const name of parent ? readdirSync(join(from, parent)) : ['.']) {
      const modules = join(parent, name, 'node_modules');
      if (existsSync(join(from, modules)) && existsSync(join(to, parent, name)))
        symlinkSync(join(from, modules), join(to, modules));
    }
};

const git = (args, options = {}) => spawnSync('git', args, { cwd: root, encoding: 'utf8', ...options });

const main = () => {
  const staged = git(['diff', '--cached', '--name-only', '--diff-filter=ACMR']);
  if (staged.status !== 0) return staged.status ?? 1;
  const files = staged.stdout.split('\n').filter(Boolean);
  const toCheck = typecheckCommands(
    files,
    (path) => readFileSync(join(root, path), 'utf8'),
    (path) => existsSync(join(root, path)),
  );
  if (toCheck.length === 0) return 0;

  const started = Date.now();
  const dir = mkdtempSync(join(tmpdir(), 'staged-typecheck-'));
  try {
    const exported = git(['checkout-index', '-a', `--prefix=${dir}/`]);
    if (exported.status !== 0) {
      process.stderr.write(exported.stderr);
      return 1;
    }
    linkNodeModules(root, dir);
    for (const { name, command } of toCheck) {
      const run = spawnSync(command, {
        cwd: dir,
        shell: true,
        encoding: 'utf8',
        env: { ...process.env, PATH: `${join(root, 'node_modules/.bin')}:${process.env['PATH']}` },
      });
      if (run.status !== 0) {
        process.stderr.write(
          `staged-typecheck: ${name} does not typecheck in the staged tree (the working tree may differ):\n${run.stdout}${run.stderr}`,
        );
        return 1;
      }
    }
    process.stdout.write(
      `staged-typecheck: ${toCheck.map((c) => c.name).join(', ')} ok in ${((Date.now() - started) / 1000).toFixed(1)} s\n`,
    );
    return 0;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exit(main());
