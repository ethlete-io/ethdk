import { HttpClient, HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DestroyRef, EnvironmentProviders, ErrorHandler, Injector } from '@angular/core';
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
  isQueryErrorResponse,
  QueryClientRef,
} from '@ethlete/query';

export type QueryTestSetup = {
  queryClient: NonNullable<ReturnType<AnyCreateQueryClientResult['inject']>>;
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

  /**
   * Puts back the `console.error` that was installed before the first {@link setupQueryTest} call. Runs
   * on its own when the `TestBed` module is reset; idempotent, and safe to call from any setup.
   */
  restoreConsole: () => void;
};

export type QueryTestSetupConfig = {
  baseUrl?: string;
  name?: string;
  /**
   * `true` swallows the `ErrorHandler` reports of failed requests and rethrows every other error, `'all'`
   * swallows everything, `false` keeps Angular's own handler.
   * @default true
   */
  mockErrorHandler?: boolean | 'all';
};

let originalError: typeof console.error | null = null;

const filteredError = (...args: unknown[]) => {
  const message = args[0];

  if (message && typeof message === 'object' && 'name' in message && message.name === 'HttpErrorResponse') {
    return;
  }

  if (typeof message === 'string' && message.includes('Failed to decrypt bearer token')) {
    return;
  }

  if (typeof message === 'string' && message.includes('Failed to extract tokens from')) {
    return;
  }

  originalError?.(...args);
};

// Capture only what is not already the wrapper, so repeated calls reinstall the one filter instead
// of nesting a new closure over the previous one and stranding the pristine handlers.
const installConsoleFilters = () => {
  if (console.error !== filteredError) originalError = console.error;

  console.error = filteredError;
};

const restoreConsole = () => {
  if (originalError && console.error === filteredError) console.error = originalError;

  originalError = null;
};

const isFailedRequestError = (error: unknown) => error instanceof HttpErrorResponse || isQueryErrorResponse(error);

const requestErrorHandler: Pick<ErrorHandler, 'handleError'> = {
  handleError: (error: unknown) => {
    if (isFailedRequestError(error)) return;

    throw error;
  },
};

export const setupQueryTest = (config?: QueryTestSetupConfig): QueryTestSetup => {
  const baseUrl = config?.baseUrl ?? 'https://api.test.com';
  const name = config?.name ?? 'test';
  const mockErrorHandler = config?.mockErrorHandler ?? true;

  installConsoleFilters();

  const providers: (EnvironmentProviders | object)[] = [
    provideHttpClient(),
    provideHttpClientTesting(),
    provideRouter([]),
  ];

  if (mockErrorHandler) {
    providers.push({
      provide: ErrorHandler,
      useValue: mockErrorHandler === 'all' ? { handleError: () => undefined } : requestErrorHandler,
    });
  }

  TestBed.configureTestingModule({ providers });

  const queryClientRef = createQueryClient({ baseUrl, name });

  return TestBed.runInInjectionContext(() => {
    const { inject } = queryClientRef;
    const queryClient = inject();

    TestBed.inject(DestroyRef).onDestroy(restoreConsole);

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
      restoreConsole,
    };
  });
};
