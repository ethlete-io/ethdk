declare module 'virtual:design-explore' {
  import type { Call } from '@design-explore';

  export const calls: Record<string, () => Promise<{ default: Call }>>;
  export const defaultCall: string | null;
}

declare module 'virtual:design-explore/env' {
  import type { EnvironmentProviders, Provider, Type } from '@angular/core';

  export const providers: (Provider | EnvironmentProviders)[];
  export const Wrapper: Type<unknown> | null;
}
