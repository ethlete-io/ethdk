import { InjectionToken, inject as ngInject } from '@angular/core';
import { createComponentId } from './component-id.utils';

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

export const createProvider = <T>(factory: () => T, options?: CreateProviderOptions) => {
  const injectionToken = new InjectionToken<T>(options?.name ?? createComponentId('provider'));

  const provide = () => [
    {
      provide: injectionToken,
      useFactory: factory,
    },
    ...(options?.extraInjectionToken ? [{ provide: options.extraInjectionToken, useExisting: injectionToken }] : []),
  ];

  const inject = () => ngInject(injectionToken);

  return [provide, inject] as const;
};

export const createStaticProviderWithDefaults = <T>(defaultValue: T, options?: CreateProviderOptions) => {
  const injectionToken = new InjectionToken<T>(options?.name ?? createComponentId('static-provider'));

  const provide = (valueOverride?: T) => [
    {
      provide: injectionToken,
      useValue: valueOverride ?? defaultValue,
    },
    ...(options?.extraInjectionToken ? [{ provide: options.extraInjectionToken, useExisting: injectionToken }] : []),
  ];

  const inject = () => ngInject(injectionToken);

  return [provide, inject] as const;
};
