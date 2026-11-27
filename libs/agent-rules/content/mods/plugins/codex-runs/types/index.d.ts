export type CodexRun = {
  id: string;
  name: string;
  cwd: string;
  owner: string;
  startedAt: number;
  endedAt: number | null;
  state: 'running' | 'waiting for input' | 'ended';
  tail: string[];
};

declare module 'claude-code' {
  interface PluginState {
    'codex-runs': {
      runs: CodexRun[];
      selected: string | null;
    };
  }
}
