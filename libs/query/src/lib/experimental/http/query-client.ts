import { HttpClient } from '@angular/common/http';
import { ErrorHandler, inject } from '@angular/core';
import { QueryClientConfig } from './query-client-config';
import { QueryRepository, createQueryRepository } from './query-repository';

export type QueryClient = {
  repository: QueryRepository;
};

export const createQueryClient = (config: QueryClientConfig) => {
  const httpClient = inject(HttpClient);
  const ngErrorHandler = inject(ErrorHandler);

  const repository = createQueryRepository({ ...config, dependencies: { httpClient, ngErrorHandler } });

  const client: QueryClient = {
    repository,
  };

  return client;
};

export const provideQueryClient = (config: QueryClientConfig) => {
  return {
    provide: config.token,
    useFactory: () => createQueryClient(config),
  };
};
