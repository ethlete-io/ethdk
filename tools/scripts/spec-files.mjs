import { execFileSync } from 'node:child_process';
import { dirname, isAbsolute, matchesGlob, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The tracked files `config`'s `test.include` selects and its `test.exclude` leaves in, relative to `repo`. */
export const specFilesOf = async (config, trackedFiles, repo = repoRoot) => {
  const { loadConfigFromFile } = await import('vite');
  const path = isAbsolute(config) ? config : resolve(repo, config);
  const loaded = await loadConfigFromFile({ command: 'serve', mode: 'test' }, path);
  const test = loaded?.config.test;
  if (!test?.include?.length) throw new Error(`${config} has no test.include`);
  const root = test.root ? resolve(dirname(path), test.root) : dirname(path);
  const exclude = test.exclude ?? ['**/node_modules/**', '**/dist/**'];

  return trackedFiles.filter((file) => {
    const inRoot = relative(root, resolve(repo, file));
    if (inRoot.startsWith('..')) return false;
    return test.include.some((glob) => matchesGlob(inRoot, glob)) && !exclude.some((glob) => matchesGlob(inRoot, glob));
  });
};

const main = async (configs) => {
  if (!configs.length) throw new Error('give at least one vitest config');
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 1 << 28 })
    .split('\0')
    .filter(Boolean);
  const files = (await Promise.all(configs.map((config) => specFilesOf(config, tracked)))).flat();
  process.stdout.write(files.map((file) => `${file}\n`).join(''));
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.env.VITE_CONFIG_NATIVE_IGNORE_WARNING = 'true';
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
