import { ElementRef, inject, InjectionToken, InjectOptions, Provider, TemplateRef } from '@angular/core';
import { createComponentId } from './component-id';

export const injectHostElement = <T = HTMLElement>() => inject<ElementRef<T>>(ElementRef).nativeElement;

export const injectTemplateRef = <C = unknown>() => inject<TemplateRef<C>>(TemplateRef);

export type ProviderDefinitionOptions = {
  /**
   * Optional name for the provider, useful for debugging.
   * If not provided, the name will be a generated string.
   */
  name?: string;

  /**
   * Optional existing InjectionToken to also provide the created provider under.
   */
  extraInjectionToken?: InjectionToken<unknown>;
};

/** The `inject`-shaped half of a provider definition: optional when asked, non-nullable otherwise. */
export type InjectFn<T> = {
  (): T;
  (options: InjectOptions & { optional?: false }): T;
  (options: InjectOptions): T | null;
};

/**
 * What {@link defineProvider} & co. return: the token plus the two functions a domain re-exports as its
 * `provideX` / `injectX` pair. Read the halves out with {@link toProvideFn}, {@link toInjectFn} and
 * {@link toToken} - never by destructuring, see {@link defineProvider}.
 */
export type ProviderDefinition<T> = {
  readonly provide: () => Provider[];
  readonly inject: InjectFn<T>;
  readonly token: InjectionToken<T>;
};

/** {@link ProviderDefinition} for a value provider, whose `provide` takes a partial override. */
export type StaticProviderDefinition<T> = {
  readonly provide: (valueOverride?: Partial<T>) => Provider[];
  readonly inject: InjectFn<T>;
  readonly token: InjectionToken<T>;
};

const createInjectFunction = <T>(token: InjectionToken<T>): InjectFn<T> => {
  function injectFn(): T;
  function injectFn(options: InjectOptions & { optional?: false }): T;
  function injectFn(options: InjectOptions): T | null;
  function injectFn(options?: InjectOptions): T | null {
    return options ? inject(token, options) : inject(token);
  }
  return injectFn;
};

const createProviders = <T>(
  token: InjectionToken<T>,
  factory: () => T,
  extraToken?: InjectionToken<unknown>,
): Provider[] => [
  { provide: token, useFactory: factory },
  ...(extraToken ? [{ provide: extraToken, useExisting: token }] : []),
];

/**
 * Defines a provider that a subtree opts into - `provideX()` in some component's `providers`, then
 * `injectX()` below it. Nothing is created until the subtree provides it.
 *
 * Assign the result to one `const`, name the halves with {@link toProvideFn} / {@link toInjectFn} /
 * {@link toToken}, and put a `__PURE__` annotation comment on each of those declarations. Never destructure
 * the definition: that declaration cannot be tree-shaken, so it ships the factory's whole closure to
 * every consumer. Enforced by `ethlete/no-impure-top-level-provider`.
 */
export const defineProvider = <T>(factory: () => T, options?: ProviderDefinitionOptions): ProviderDefinition<T> => {
  const token = new InjectionToken<T>(options?.name ?? createComponentId('provider'));

  return {
    provide: () => createProviders(token, factory, options?.extraInjectionToken),
    inject: createInjectFunction(token),
    token,
  };
};

/**
 * Like {@link defineProvider}, but the factory also runs in the root injector, so `injectX()` works
 * without anyone calling `provideX()`. `provideX()` still exists, to give a subtree its own instance.
 */
export const defineRootProvider = <T>(factory: () => T, options?: ProviderDefinitionOptions): ProviderDefinition<T> => {
  const token = new InjectionToken<T>(options?.name ?? createComponentId('provider'), {
    providedIn: 'root',
    factory,
  });

  return {
    provide: () => createProviders(token, factory, options?.extraInjectionToken),
    inject: createInjectFunction(token),
    token,
  };
};

/**
 * Like {@link defineProvider} for a plain value rather than a factory: `provideX(override)` merges the
 * partial override over `defaultValue`, which is how every config object in the library is shaped.
 */
export const defineStaticProvider = <T>(
  defaultValue?: T,
  options?: ProviderDefinitionOptions,
): StaticProviderDefinition<T> => {
  const token = new InjectionToken<T>(options?.name ?? createComponentId('static-provider'));

  return {
    provide: (valueOverride?: Partial<T>) => createValueProviders(token, defaultValue, valueOverride, options),
    inject: createInjectFunction(token),
    token,
  };
};

/**
 * {@link defineStaticProvider} whose default is also available in the root injector, so `injectX()`
 * resolves to `defaultValue` in an app that never provides it.
 */
export const defineStaticRootProvider = <T>(
  defaultValue?: T,
  options?: ProviderDefinitionOptions,
): StaticProviderDefinition<T> => {
  const token = new InjectionToken<T>(options?.name ?? createComponentId('static-provider'), {
    providedIn: 'root',
    factory: () => defaultValue as T,
  });

  return {
    provide: (valueOverride?: Partial<T>) => createValueProviders(token, defaultValue, valueOverride, options),
    inject: createInjectFunction(token),
    token,
  };
};

/** The `provideX` half of a provider definition. A call, so a `__PURE__` annotation makes it droppable. */
export const toProvideFn = <TDefinition extends { readonly provide: unknown }>(
  definition: TDefinition,
): TDefinition['provide'] => definition.provide;

/** The `injectX` half of a provider definition. */
export const toInjectFn = <TDefinition extends { readonly inject: unknown }>(
  definition: TDefinition,
): TDefinition['inject'] => definition.inject;

/** The token behind a provider definition. */
export const toToken = <TDefinition extends { readonly token: unknown }>(
  definition: TDefinition,
): TDefinition['token'] => definition.token;

const createValueProviders = <T>(
  token: InjectionToken<T>,
  defaultValue: T | undefined,
  valueOverride: Partial<T> | undefined,
  options: ProviderDefinitionOptions | undefined,
): Provider[] => [
  { provide: token, useValue: maybeMergeValues(defaultValue, valueOverride) },
  ...(options?.extraInjectionToken ? [{ provide: options.extraInjectionToken, useExisting: token }] : []),
];

const maybeMergeValues = <T>(defaultValue: T | undefined, valueOverride?: Partial<T>) => {
  if (valueOverride && defaultValue && typeof defaultValue === 'object') {
    return { ...defaultValue, ...valueOverride };
  }

  return valueOverride ?? defaultValue;
};
