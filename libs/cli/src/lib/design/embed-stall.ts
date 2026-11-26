const watchers = new Set<(message: string) => void>();

/** Tells every `watchEmbedStalls` run in flight that a frame timed out waiting for its embedded frames. */
export const reportEmbedStall = (message: string) => watchers.forEach((watcher) => watcher(message));

/** Runs `run` and resolves its result with the messages `reportEmbedStall` got while it ran. */
export const watchEmbedStalls = async <T>(run: () => Promise<T>) => {
  const stalls: string[] = [];
  const watcher = (message: string) => void stalls.push(message);

  watchers.add(watcher);

  try {
    return { result: await run(), stalls };
  } finally {
    watchers.delete(watcher);
  }
};
