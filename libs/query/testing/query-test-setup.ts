import { HttpClient, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { EnvironmentProviders, ErrorHandler, Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  AnyCreateQueryClientResult,
  createDeleteQuery,
  createGetQuery,
  createPatchQuery,
  createPostQuery,
  createPutQuery,
  createQueryClient,
  QueryClientRef,
} from '@ethlete/query';

export type QueryTestSetup = {
  queryClient: NonNullable<ReturnType<AnyCreateQueryClientResult[1]>>;
  queryClientRef: QueryClientRef;
  httpClient: HttpClient;
  httpTesting: HttpTestingController;
  injector: Injector;
  baseUrl: string;
  createGet: ReturnType<typeof createGetQuery>;
  createPost: ReturnType<typeof createPostQuery>;
  createPut: ReturnType<typeof createPutQuery>;
  createPatch: ReturnType<typeof createPatchQuery>;
  createDelete: ReturnType<typeof createDeleteQuery>;
};

export type QueryTestSetupConfig = {
  baseUrl?: string;
  name?: string;
  mockErrorHandler?: boolean;
};

export const setupQueryTest = (config?: QueryTestSetupConfig): QueryTestSetup => {
  const baseUrl = config?.baseUrl ?? 'https://api.test.com';
  const name = config?.name ?? 'test';
  const mockErrorHandler = config?.mockErrorHandler !== false;

  const providers: (EnvironmentProviders | object)[] = [
    provideHttpClient(),
    provideHttpClientTesting(),
    provideRouter([]),
  ];

  if (mockErrorHandler) {
    providers.push({
      provide: ErrorHandler,
      useValue: { handleError: () => undefined },
    });
  }

  TestBed.configureTestingModule({ providers });

  const queryClientRef = createQueryClient({ baseUrl, name });

  const setup = TestBed.runInInjectionContext(() => {
    const [, inject] = queryClientRef;
    const queryClient = inject();

    if (!queryClient) {
      throw new Error('Failed to create query client in test setup');
    }

    return {
      queryClient,
      queryClientRef,
      httpClient: TestBed.inject(HttpClient),
      httpTesting: TestBed.inject(HttpTestingController),
      injector: TestBed.inject(Injector),
      baseUrl,
      createGet: createGetQuery(queryClientRef),
      createPost: createPostQuery(queryClientRef),
      createPut: createPutQuery(queryClientRef),
      createPatch: createPatchQuery(queryClientRef),
      createDelete: createDeleteQuery(queryClientRef),
    };
  });

  return setup;
};
