import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, relative } from 'path';

const MOCKS_DIR = 'libs/components/design';
const BUILT_DIR = 'dist/libs/components/design';
const SKIPPED_FILE = /\.(spec|stories)\.ts$/;

export const MOCKS_BUILD_COMMAND = 'NX_NO_CLOUD=true npx nx build components';

const filesOf = (dir: string, base = dir): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : filesOf(path, base);

    return entry.isFile() && !SKIPPED_FILE.test(entry.name) ? [relative(base, path)] : [];
  });

export type StaleDesignMocks = { stale: string[]; command: string; message: string };

/**
 * The mock files of `libs/components/design` whose build in `dist/libs/components/design` is missing or differs, compared
 * by content so a checkout or branch switch cannot hide or fake a stale build. Answers null when the checkout has no
 * mocks or every one is built.
 */
export const staleDesignMocksOf = (options: { target: string }): StaleDesignMocks | null => {
  const source = join(options.target, MOCKS_DIR);
  const built = join(options.target, BUILT_DIR);

  if (!existsSync(source)) return null;

  const stale = filesOf(source).filter((file) => {
    const builtFile = join(built, file);

    return !existsSync(builtFile) || !readFileSync(join(source, file)).equals(readFileSync(builtFile));
  });

  if (stale.length === 0) return null;

  const shown = stale.slice(0, 5).join(', ');

  return {
    stale,
    command: MOCKS_BUILD_COMMAND,
    message: `REFUSED STALE DESIGN MOCKS - ${MOCKS_DIR} differs from ${BUILT_DIR} (${shown}${stale.length > 5 ? `, +${stale.length - 5} more` : ''}); the drawings use the old mocks - run ${MOCKS_BUILD_COMMAND}`,
  };
};

const GUARDED = new Set(['check', 'shot']);
const GUARDED_SKETCH = new Set(['check', 'ready']);

const SOURCE_ONLY_CHECKS = ['--app-classes', '--rules'];

/** Whether `et design <argv>` draws with the built mocks and must refuse while they are stale. `check --app-classes` and `check --rules` read only the source. */
export const guardsDesignMocks = (argv: string[]) =>
  argv[0] === 'sketch'
    ? GUARDED_SKETCH.has(argv[1] ?? '')
    : GUARDED.has(argv[0] ?? '') && !(argv[0] === 'check' && SOURCE_ONLY_CHECKS.some((flag) => argv.includes(flag)));

/** Prints the refusal and answers false while the mocks are stale. */
export const designMocksFresh = (options: { target: string }) => {
  const stale = staleDesignMocksOf(options);

  if (stale) console.error(stale.message);

  return !stale;
};
