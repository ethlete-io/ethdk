import { QueryClientConfig } from './query-client-config';
import { QueryRepository, createQueryRepository } from './query-repository';

export type QueryClient = {
  repository: QueryRepository;
};

export const createQueryClient = (config: QueryClientConfig) => {
  const repository = createQueryRepository(config);

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
