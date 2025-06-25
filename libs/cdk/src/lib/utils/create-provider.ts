import { InjectionToken, inject as ngInject } from '@angular/core';
import { createComponentId } from '@ethlete/core';

export type CreateProviderOptions = {
  /**
   * Optional name for the provider, useful for debugging.
   * If not provided, the name will be a generated string.
   */
  name?: string;
};

export const createProvider = <T>(factory: () => T, options?: CreateProviderOptions) => {
  const injectionToken = new InjectionToken<T>(options?.name ?? createComponentId('provider'));

  const provide = () => ({
    provide: injectionToken,
    useFactory: factory,
  });

  const inject = () => ngInject(injectionToken);

  return [provide, inject] as const;
};
