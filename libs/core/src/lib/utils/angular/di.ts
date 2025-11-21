import { ElementRef, inject, InjectionToken, InjectOptions, Provider, TemplateRef } from '@angular/core';
import { createComponentId } from './component-id';

export const injectHostElement = <T = HTMLElement>() => inject<ElementRef<T>>(ElementRef).nativeElement;

export const injectTemplateRef = <C = unknown>() => inject<TemplateRef<C>>(TemplateRef);

export type CreateProviderOptions = {
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

export type ProviderResult<T> = readonly [
  provide: () => Provider[],
  inject: {
    (): T;
    (options: InjectOptions & { optional?: false }): T;
    (options: InjectOptions): T | null;
  },
  token: InjectionToken<T>,
];

export type StaticProviderResult<T> = readonly [
  provide: (valueOverride?: T) => Provider[],
  inject: {
    (): T;
    (options: InjectOptions & { optional?: false }): T;
    (options: InjectOptions): T | null;
  },
  token: InjectionToken<T>,
];

export type RootProviderResult<T> = readonly [
  inject: {
    (): T;
    (options: InjectOptions & { optional?: false }): T;
    (options: InjectOptions): T | null;
  },
  token: InjectionToken<T>,
];

const createInjectFunction = <T>(token: InjectionToken<T>) => {
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

export const createProvider = <T>(factory: () => T, options?: CreateProviderOptions): ProviderResult<T> => {
  const token = new InjectionToken<T>(options?.name ?? createComponentId('provider'));
  const provide = () => createProviders(token, factory, options?.extraInjectionToken);
  const injectFn = createInjectFunction(token);

  return [provide, injectFn, token] as const;
};

export const createRootProvider = <T>(factory: () => T, options?: CreateProviderOptions): RootProviderResult<T> => {
  const token = new InjectionToken<T>(options?.name ?? createComponentId('provider'), {
    providedIn: 'root',
    factory,
  });

  const injectFn = createInjectFunction(token);

  return [injectFn, token] as const;
};

export const createStaticProvider = <T>(defaultValue?: T, options?: CreateProviderOptions): StaticProviderResult<T> => {
  const token = new InjectionToken<T>(options?.name ?? createComponentId('static-provider'));

  const provide = (valueOverride?: T) => [
    { provide: token, useValue: valueOverride ?? defaultValue },
    ...(options?.extraInjectionToken ? [{ provide: options.extraInjectionToken, useExisting: token }] : []),
  ];

  const injectFn = createInjectFunction(token);

  return [provide, injectFn, token] as const;
};

export const createStaticRootProvider = <T>(
  defaultValue?: T,
  options?: CreateProviderOptions,
): RootProviderResult<T> => {
  const token = new InjectionToken<T>(options?.name ?? createComponentId('static-provider'), {
    providedIn: 'root',
    factory: () => defaultValue as T,
  });

  const injectFn = createInjectFunction(token);

  return [injectFn, token] as const;
};
