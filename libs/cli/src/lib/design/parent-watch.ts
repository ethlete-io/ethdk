import { isRunning } from './is-running';

export const PARENT_WATCH_MS = 5_000;

export const exitWhenParentGone = (options: {
  onGone: () => void;
  ppid?: () => number;
  alive?: (pid: number) => boolean;
  everyMs?: number;
}) => {
  const { onGone, ppid = () => process.ppid, alive = isRunning, everyMs = PARENT_WATCH_MS } = options;
  const parent = ppid();
  const timer = setInterval(() => {
    if (ppid() === parent && alive(parent)) return;

    clearInterval(timer);
    onGone();
  }, everyMs);

  timer.unref();

  return () => clearInterval(timer);
};
