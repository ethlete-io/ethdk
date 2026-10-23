declare module 'virtual:design-explore' {
  import type { Call } from '@design-explore';

  export const calls: Record<string, () => Promise<{ default: Call }>>;
}

declare module 'virtual:design-explore/env' {
  /** Loads the stylesheet the project draws under. A project the config names not draws bare. */
  export const loadEnv: (project: string) => Promise<unknown>;
  /** The theme names the config declares for the project. The first of each list is the default. */
  export const themesOf: (project: string) => { surface: string[]; color: string[] };
}
