declare module 'virtual:design-explore' {
  import type { Call } from '@design-explore';

  export const calls: Record<string, () => Promise<{ default: Call }>>;
  export const defaultCall: string | null;
}

declare module 'virtual:design-explore/env' {
  /** Loads the stylesheet the project draws under. A project the config names not draws bare. */
  export const loadEnv: (project: string) => Promise<unknown>;
}
