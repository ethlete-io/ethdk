import { FSWatcher, readdirSync, watch } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

export type RearmWatch = { close: () => void };

/**
 * Watches each directory in `dirs` directly and calls `onFile` for every file that changes in it, also after the
 * directory or one of its parents up to `root` is deleted and recreated. A watcher that follows the path through
 * Vite's chokidar keeps the inode of the deleted directory and never sees the new one.
 */
export const watchRecreatedDirs = (options: {
  root: string;
  dirs: string[];
  onFile: (file: string) => void;
}): RearmWatch => {
  const { root, dirs, onFile } = options;
  let watchers: FSWatcher[] = [];
  let closed = false;

  const levelsOf = (dir: string) => {
    const levels: string[] = [];

    for (let level = dir; ; level = dirname(level)) {
      levels.unshift(level);

      if (level === root || relative(root, level).startsWith('..')) break;
    }

    return levels;
  };

  const attach = (path: string, listener: (name: string) => void) => {
    try {
      const watcher = watch(path, (_, name) => name && listener(name));

      watcher.on('error', () => undefined);
      watchers.push(watcher);
    } catch {
      return;
    }
  };

  const arm = () => {
    for (const watcher of watchers) watcher.close();

    watchers = [];

    for (const dir of dirs) {
      for (const level of levelsOf(dir)) {
        const isTarget = level === dir;

        attach(level, (name) => {
          if (closed) return;

          if (isTarget) return onFile(join(level, name));

          const child = join(level, name);

          if (dir === child || dir.startsWith(`${child}${sep}`)) {
            arm();
            rescan(dir);
          }
        });
      }
    }
  };

  const rescan = (dir: string) => {
    try {
      for (const name of readdirSync(dir)) onFile(join(dir, name));
    } catch {
      return;
    }
  };

  arm();

  return {
    close: () => {
      closed = true;

      for (const watcher of watchers) watcher.close();

      watchers = [];
    },
  };
};
