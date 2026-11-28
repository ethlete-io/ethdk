import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

// Must match PINNED_FILE in tools/scripts/studio-code.mjs.
const PINNED_COMMIT_FILE = 'pinned-commit';

const SOURCE_DIRS = ['src', 'design', 'playwright'];
const DESIGN_LIB_SOURCE_DIRS = ['src', 'design'];
const CLI_CORE_SOURCE_DIRS = ['src'];
const IGNORED_SUFFIXES = ['.spec.ts', '.md'];

const filesOf = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.name !== 'node_modules' && !entry.isSymbolicLink())
    .flatMap((entry) => (entry.isDirectory() ? filesOf(join(dir, entry.name)) : [join(dir, entry.name)]))
    .filter((file) => !IGNORED_SUFFIXES.some((suffix) => file.endsWith(suffix)));

export const toPosixPath = (path: string, separator: string = sep) => path.split(separator).join('/');

export const compareBytes = (a: string, b: string) => Buffer.compare(Buffer.from(a), Buffer.from(b));

/** Hash of the CLI sources that end up in a build, including the sibling `libs/design` and `libs/cli-core` the build bundles: contents and paths, not mtimes. */
export const cliSourceHash = (cliRoot: string) => {
  const hash = createHash('sha256');

  const designRoot = join(cliRoot, '..', 'design');
  const coreRoot = join(cliRoot, '..', 'cli-core');
  const roots = [
    ...SOURCE_DIRS.map((dir) => join(cliRoot, dir)),
    ...DESIGN_LIB_SOURCE_DIRS.map((dir) => join(designRoot, dir)),
    ...CLI_CORE_SOURCE_DIRS.map((dir) => join(coreRoot, dir)),
  ];

  for (const path of roots) {
    if (!existsSync(path)) continue;

    const files = filesOf(path)
      .map((file) => ({ file, key: toPosixPath(relative(cliRoot, file)) }))
      .sort((a, b) => compareBytes(a.key, b.key));

    for (const { file, key } of files) {
      hash.update(key);
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
    'This CLI build is stale: libs/cli, libs/cli-core or libs/design sources differ from what dist/libs/cli was built from,',
    'so its results can be wrong (`nx compile cli` does not refresh dist). Rebuild it:',
    '',
    '  NX_NO_CLOUD=true npx nx build cli',
  ].join('\n');
};
