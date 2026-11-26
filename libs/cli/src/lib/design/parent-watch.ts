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
  // An RxJS interval cannot unref, and a ref'd timer keeps a design server alive after its parent is gone.
  // eslint-disable-next-line ethlete/prefer-rxjs-timer
  const timer = setInterval(() => {
    if (ppid() === parent && alive(parent)) return;

    // eslint-disable-next-line ethlete/prefer-rxjs-timer
    clearInterval(timer);
    onGone();
  }, everyMs);

  timer.unref();

  // eslint-disable-next-line ethlete/prefer-rxjs-timer
  return () => clearInterval(timer);
};
