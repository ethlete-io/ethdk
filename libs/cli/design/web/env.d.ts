declare module 'virtual:design-explore' {
  import type { Call } from '@design-explore';

  export const calls: Record<string, () => Promise<{ default: Call }>>;
}

declare module 'virtual:design-explore/env' {
  /** Loads the stylesheet the project draws under. A project the config names not draws bare. */
  export const loadEnv: (project: string) => Promise<unknown>;
  /** The theme names the config declares for the project. The first of each list is the default. */
  export const themesOf: (project: string) => { surface: string[]; color: string[] };
  /** Loads the stylesheet a product draws under, which its base parts draw under too. */
  export const loadProductEnv: (product: string) => Promise<unknown>;
}

declare module 'virtual:design-explore/system' {
  import type { Drawing } from '@design-explore';

  type Part = { states: Record<string, unknown>; render: (props: unknown) => Drawing | Promise<Drawing> };

  /** Each product's parts by `<layer>/<name>`, each resolved as that product draws it. */
  export const parts: Record<string, Record<string, () => Promise<{ default: Part }>>>;
}
