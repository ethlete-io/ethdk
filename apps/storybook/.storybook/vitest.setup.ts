import { afterEach, beforeEach } from 'vitest';
import '../src/styles/vitest.css';

// Angular's ErrorHandler catches render errors and only logs them, so without this a story that
// throws in its template still passes.
const loggedErrors: unknown[][] = [];
const originalConsoleError = console.error;

beforeEach(() => {
  // The page is reused between story files. A hash route left by a routing story would reach the
  // next story's router, which has no matching route and logs NG04002.
  history.replaceState(null, '', location.pathname + location.search);
  loggedErrors.length = 0;
  console.error = (...args: unknown[]) => {
    loggedErrors.push(args);
    originalConsoleError(...args);
  };
});

afterEach(() => {
  console.error = originalConsoleError;

  if (loggedErrors.length) {
    throw new Error(
      `The story logged ${loggedErrors.length} error(s). First: ${String(loggedErrors[0]?.[1] ?? loggedErrors[0]?.[0])}`,
    );
  }
});
