export const SLOW_CASE_SHARE = 0.5;

export const slowCaseProblemOf = ({
  elapsedMs,
  timeoutMs,
  ci,
}: {
  elapsedMs: number;
  timeoutMs: number;
  ci: boolean;
}) =>
  !ci && timeoutMs > 0 && elapsedMs > timeoutMs * SLOW_CASE_SHARE
    ? `the case took ${Math.round(elapsedMs)} ms of its ${timeoutMs} ms timeout - move a one-time cost (a cold compile) into beforeAll, or make the case faster`
    : null;
