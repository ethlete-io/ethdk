export type Progress = {
  path: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  flaky: number;
  didNotRun: number;
  workers: number;
  duration: string | undefined;
  expected: number;
  isDone: boolean;
  failures: string[];
  mtimeMs: number;
  firstSeenMs: number;
  firstDone: number;
};

declare module 'claude-code' {
  interface PluginState {
    'e2e-progress': { runs: Progress[]; path: string | null };
  }
}
