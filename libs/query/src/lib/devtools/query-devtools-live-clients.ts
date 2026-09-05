import { signal } from '@angular/core';
import { QueryRepository } from '../http/query-repository';

const live = /* @__PURE__ */ new Set<QueryRepository>();

const version = /* @__PURE__ */ signal(0);

/**
 * Records a client's repository as alive until its injector is destroyed. Only ever called while
 * {@link provideQueryDevtools} is installed. Returns the teardown to hand the client's `DestroyRef`.
 * @internal
 */
export const registerLiveQueryDevtoolsRepository = (repository: QueryRepository) => {
  live.add(repository);
  version.update((current) => current + 1);

  return () => {
    live.delete(repository);
    version.update((current) => current + 1);
  };
};

/**
 * Whether the client that owns a repository is still alive. A destroyed client's queries survive as
 * tombstones, which keep their `meta.repository`, so this is the only way to tell a dead client from
 * one whose queries all happen to be destroyed.
 *
 * Reads a version signal, so a computed that calls it recomputes as clients come and go.
 *
 * Part of the devtools contract. **Not part of the general public contract.**
 */
export const isQueryDevtoolsRepositoryLive = (repository: QueryRepository) => {
  version();

  return live.has(repository);
};
