import { resolve, sep } from 'path';

type FSWatcher = import('vite', { with: { 'resolution-mode': 'import' } }).FSWatcher;

/**
 * Makes `watcher.add` skip every path inside `dirs`, which the watcher already watches whole.
 *
 * Workaround: chokidar 3 (bundled by Vite) treats an `add` of a single file as an initial add, so with Vite's
 * `ignoreInitial` it emits no `add` event, and it marks the file as known, so the directory's own scan skips it
 * too. Vite calls `add` for each dependency a CSS transform reports, and Tailwind reports every file it scanned,
 * so a file created just before a stylesheet transform never got its `add` event.
 */
export const skipCoveredAdds = (watcher: FSWatcher, dirs: string[]) => {
  const add = watcher.add.bind(watcher);
  const covered = (path: string) => dirs.some((dir) => resolve(path).startsWith(`${resolve(dir)}${sep}`));

  watcher.add = (paths) => add((typeof paths === 'string' ? [paths] : paths).filter((path) => !covered(path)));

  return watcher;
};
