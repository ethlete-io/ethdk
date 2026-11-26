import { describe, expect, it } from 'vitest';
import { isStaleBuildError } from './stale-build-error';

describe('isStaleBuildError', () => {
  it.each([
    ['Chrome', 'Failed to fetch dynamically imported module: https://app.test/chunk-A1B2C3.js'],
    ['Firefox', 'error loading dynamically imported module'],
    ['Safari', 'Importing a module script failed.'],
    [
      'an SPA fallback answering with HTML',
      'Failed to load module script: Expected a JavaScript-or-Wasm module script',
    ],
    ['Firefox on a MIME mismatch', 'Loading module from "/chunk.js" was blocked because of a disallowed MIME type'],
    ['a missing lazy stylesheet', 'Unable to preload CSS for /styles-A1B2C3.css'],
  ])('recognizes the failure %s reports', (_engine, message) => {
    expect(isStaleBuildError(new TypeError(message))).toBe(true);
  });

  it('recognizes a bundler chunk error by name, whatever its message', () => {
    const error = new Error('Loading chunk 42 failed.');
    error.name = 'ChunkLoadError';

    expect(isStaleBuildError(error)).toBe(true);
  });

  it('reads a bare message string and a rejection reason object', () => {
    expect(isStaleBuildError('Failed to fetch dynamically imported module: /chunk.js')).toBe(true);
    expect(isStaleBuildError({ message: 'error loading dynamically imported module' })).toBe(true);
  });

  it.each([
    ['a failed API call', new Error('Failed to fetch')],
    ['an app-level error', new TypeError("Cannot read properties of undefined (reading 'id')")],
    ['nothing at all', null],
    ['an empty message', new Error('')],
  ])('leaves %s alone', (_case, error) => {
    expect(isStaleBuildError(error)).toBe(false);
  });
});
