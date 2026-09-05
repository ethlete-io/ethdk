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
   * Puts back the `console.warn` / `console.error` that were installed before the first
   * {@link setupQueryTest} call. Idempotent, and safe to call from any of the setups a file created.
   */
  restoreConsole: () => void;
};

export type QueryTestSetupConfig = {
  baseUrl?: string;
  name?: string;
  mockErrorHandler?: boolean;
};

let originalWarn: typeof console.warn | null = null;
let originalError: typeof console.error | null = null;

const filteredWarn = (...args: unknown[]) => {
  const message = args[0];

  if (typeof message === 'string' && message.includes('auto-refresh')) {
    return;
  }

  originalWarn?.(...args);
};

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
  if (console.warn !== filteredWarn) originalWarn = console.warn;
  if (console.error !== filteredError) originalError = console.error;

  console.warn = filteredWarn;
  console.error = filteredError;
};

const restoreConsole = () => {
  if (originalWarn && console.warn === filteredWarn) console.warn = originalWarn;
  if (originalError && console.error === filteredError) console.error = originalError;

  originalWarn = null;
  originalError = null;
};

export const setupQueryTest = (config?: QueryTestSetupConfig): QueryTestSetup => {
  const baseUrl = config?.baseUrl ?? 'https://api.test.com';
  const name = config?.name ?? 'test';
  const mockErrorHandler = config?.mockErrorHandler !== false;

  installConsoleFilters();

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

  return TestBed.runInInjectionContext(() => {
    const { inject } = queryClientRef;
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
      restoreConsole,
    };
  });
};
