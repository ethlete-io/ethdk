import { inject, ProviderToken } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { QueryRuntimeErrorCode } from '../query-errors';

// Angular has no public check for an injection context; `inject()` outside one throws NG0203 (`code: -203`).
const MISSING_INJECTION_CONTEXT = -203;

type QueryContextKind = 'query' | 'query stack' | 'query group';

const queryCreatedOutsideInjectionContext = (kind: QueryContextKind) => {
  const fix =
    kind === 'query'
      ? 'or pass an injector as the first creator argument: getPost({ injector: this.injector }, withArgs(...))'
      : 'or wrap the call in runInInjectionContext(this.injector, () => ...)';

  return new RuntimeError(
    QueryRuntimeErrorCode.QUERY_CREATED_OUTSIDE_INJECTION_CONTEXT,
    `A ${kind} was created outside an injection context (in ngOnInit, an event handler or a timer). Create it in a field initializer or constructor, ${fix}.`,
  );
};

export const injectInQueryContext = <T>(token: ProviderToken<T>, kind: QueryContextKind): T => {
  try {
    return inject(token);
  } catch (error) {
    if ((error as { code?: unknown } | null)?.code === MISSING_INJECTION_CONTEXT) {
      throw queryCreatedOutsideInjectionContext(kind);
    }

    throw error;
  }
};
