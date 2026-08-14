/**
 * How each engine words a lazy chunk that could not be loaded. There is no error code and no shared
 * type for this - the message is all a browser gives, so matching it is the only detection available.
 *
 * The MIME-type entries matter as much as the 404 ones: an SPA that rewrites unknown paths to
 * `index.html` answers a request for a deleted chunk with HTML and a 200, so the import fails on the
 * content type rather than on the status.
 */
const STALE_BUILD_ERROR_PATTERNS = [
  'failed to fetch dynamically imported module',
  'error loading dynamically imported module',
  'importing a module script failed',
  'failed to load module script',
  'was blocked because of a disallowed mime type',
  'expected a javascript-or-wasm module script',
  'unable to preload css',
  'loading chunk',
  'loading css chunk',
];

const readErrorMessage = (error: unknown) => {
  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }

  return '';
};

/**
 * Whether an error means the running build is stale - a module it was going to import lazily is no
 * longer on the server, so this tab cannot reach that part of the app until it reloads.
 *
 * Accepts anything an error path hands over: an `Error`, a rejection reason, a message string.
 */
export const isStaleBuildError = (error: unknown) => {
  if (error && typeof error === 'object' && 'name' in error && error.name === 'ChunkLoadError') {
    return true;
  }

  const message = readErrorMessage(error).toLowerCase();

  return !!message && STALE_BUILD_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
};
