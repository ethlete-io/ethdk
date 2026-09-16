import type { EnvironmentProviders, Provider, Type } from '@angular/core';

/*
 * A frame must not import an @ethlete barrel. The libs resolve to source here, so one barrel makes
 * the browser ask for every module in the library and the requests fail with ERR_INSUFFICIENT_RESOURCES.
 * A call that needs the real component library has to pre-bundle it first.
 */
export const providers: (Provider | EnvironmentProviders)[] = [];

export const Wrapper: Type<unknown> | null = null;
