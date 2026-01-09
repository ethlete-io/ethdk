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

  // Suppress console.warn for auth-related warnings during tests
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    const message = args[0];
    if (typeof message === 'string' && message.includes('auto-refresh')) {
      return; // Suppress auto-refresh warnings
    }
    originalWarn(...args);
  };

  // Suppress console.error for expected error scenarios during tests
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    const message = args[0];
    // Suppress HttpErrorResponse logs
    if (message && typeof message === 'object' && 'name' in message && message.name === 'HttpErrorResponse') {
      return;
    }
    // Suppress bearer token decryption errors
    if (typeof message === 'string' && message.includes('Failed to decrypt bearer token')) {
      return;
    }
    // Suppress token extraction errors
    if (typeof message === 'string' && message.includes('Failed to extract tokens from')) {
      return;
    }
    originalError(...args);
  };

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

  // Restore console.warn and console.error when tests are done
  const restoreConsole = () => {
    console.warn = originalWarn;
    console.error = originalError;
  };

  // Store the restore function for cleanup
  (setup as any)._restoreConsole = restoreConsole;

  return setup;
};
