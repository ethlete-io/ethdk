import { readsCacheOf } from '../tracked-reads';

type CheckRequest = { kind: string; target: string; product: string };

/**
 * Wraps a synchronous check so it runs again only when a file or folder listing its last run for the same request
 * read prints differently; a throwing run keeps nothing.
 */
export const cachedCheckOf = <TRequest extends CheckRequest, T>(check: (request: TRequest) => T) =>
  readsCacheOf({ slotOf: (request: TRequest) => `${request.kind}\n${request.target}\n${request.product}`, run: check });
