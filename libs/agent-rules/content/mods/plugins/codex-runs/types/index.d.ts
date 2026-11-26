declare module 'claude-code' {
  interface PluginState {
    'codex-runs': {
      runs: import('../hooks/progress').CodexRun[];
      selected: string | null;
    };
  }
}
