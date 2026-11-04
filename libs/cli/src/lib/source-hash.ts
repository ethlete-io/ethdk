import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

// Must match PINNED_FILE in tools/scripts/studio-code.mjs.
const PINNED_COMMIT_FILE = 'pinned-commit';

const SOURCE_DIRS = ['src', 'design', 'playwright'];
const IGNORED_SUFFIXES = ['.spec.ts', '.md'];

const filesOf = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.name !== 'node_modules')
    .flatMap((entry) => (entry.isDirectory() ? filesOf(join(dir, entry.name)) : [join(dir, entry.name)]))
    .filter((file) => !IGNORED_SUFFIXES.some((suffix) => file.endsWith(suffix)));

/** Hash of the CLI sources that end up in a build: contents and paths, not mtimes. */
export const cliSourceHash = (cliRoot: string) => {
  const hash = createHash('sha256');

  for (const dir of SOURCE_DIRS) {
    const path = join(cliRoot, dir);

    if (!existsSync(path)) continue;

    for (const file of filesOf(path).sort()) {
      hash.update(relative(cliRoot, file));
      hash.update('\0');
      hash.update(readFileSync(file));
      hash.update('\0');
    }
  }

  return hash.digest('hex');
};

const cliRootAbove = (start: string): string | undefined => {
  const dir = resolve(start);
  const cliRoot = join(dir, 'libs', 'cli');

  if (existsSync(join(cliRoot, 'src'))) return cliRoot;

  return dirname(dir) === dir ? undefined : cliRootAbove(dirname(dir));
};

/** The refusal text when the libs/cli sources of the checkout at or above `root` differ from what `buildDir` was built from, else undefined. */
export const staleCliBuildMessage = (options: { root: string; buildDir: string }) => {
  const cliRoot = cliRootAbove(options.root);
  const infoPath = join(options.buildDir, 'build-info.json');

  if (!cliRoot || existsSync(join(options.buildDir, PINNED_COMMIT_FILE))) return undefined;

  let recorded: unknown;

  try {
    recorded = (JSON.parse(readFileSync(infoPath, 'utf8')) as { sourceHash?: unknown }).sourceHash;
  } catch {
    recorded = undefined;
  }

  if (recorded === cliSourceHash(cliRoot)) return undefined;

  return [
    'This CLI build is stale: libs/cli sources differ from what dist/libs/cli was built from,',
    'so its results can be wrong (`nx compile cli` does not refresh dist). Rebuild it:',
    '',
    '  NX_NO_CLOUD=true npx nx build cli',
  ].join('\n');
};
