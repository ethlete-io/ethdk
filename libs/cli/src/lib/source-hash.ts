import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

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

/** The refusal text when the libs/cli sources of `root` differ from what a `buildDir` inside `root` was built from, else undefined. */
export const staleCliBuildMessage = (options: { root: string; buildDir: string }) => {
  const cliRoot = join(options.root, 'libs', 'cli');
  const infoPath = join(options.buildDir, 'build-info.json');

  if (!existsSync(join(cliRoot, 'src'))) return undefined;

  if (!(realpathSync(options.buildDir) + sep).startsWith(realpathSync(options.root) + sep)) return undefined;

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
