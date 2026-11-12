import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const VALUE_FLAGS = new Set([
  '-c',
  '--config',
  '-r',
  '--root',
  '--dir',
  '-t',
  '--testNamePattern',
  '--project',
  '--reporter',
  '--outputFile',
  '--environment',
  '--pool',
  '--shard',
  '--maxWorkers',
  '--mode',
  '--changed',
  '--testTimeout',
  '--hookTimeout',
  '--exclude',
]);

/** The arguments of a `vitest related` call that name no existing path, read from a vitest argv; empty for any other command. */
export const missingRelatedPathsOf = (argv, cwd) => {
  const args = argv.slice(2);

  if (args[0] !== 'related') return [];

  const missing = [];

  for (let index = 1; index < args.length; index++) {
    const arg = args[index];

    if (arg.startsWith('-')) {
      if (VALUE_FLAGS.has(arg)) index++;
      continue;
    }

    if (!existsSync(resolve(cwd, arg))) missing.push(arg);
  }

  return missing;
};

/** Ends the process with exit 2 and one line when a `vitest related` call names an argument that is not an existing path. */
export const refuseMissingRelatedPaths = (argv = process.argv, cwd = process.cwd()) => {
  const missing = missingRelatedPathsOf(argv, cwd);

  if (missing.length === 0) return;

  console.error(
    `vitest related: not an existing path: ${missing.map((arg) => JSON.stringify(arg)).join(' ')} - pass only files (an option value as --flag=value)`,
  );
  process.exit(2);
};
