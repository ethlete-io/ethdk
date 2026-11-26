import { computed } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { QueryRepository } from '../http/query-repository';
import { isQueryDevtoolsRepositoryLive, registerLiveQueryDevtoolsRepository } from './query-devtools-live-clients';

const fakeRepository = () => ({}) as QueryRepository;

describe('isQueryDevtoolsRepositoryLive', () => {
  it('should read an unregistered repository as dead', () => {
    expect(isQueryDevtoolsRepositoryLive(fakeRepository())).toBe(false);
  });

  it('should flip once the registration is torn down', () => {
    const repository = fakeRepository();
    const teardown = registerLiveQueryDevtoolsRepository(repository);

    expect(isQueryDevtoolsRepositoryLive(repository)).toBe(true);

    teardown();

    expect(isQueryDevtoolsRepositoryLive(repository)).toBe(false);
  });

  it('should recompute a computed that reads it, in both directions', () => {
    const repository = fakeRepository();
    const live = computed(() => isQueryDevtoolsRepositoryLive(repository));

    expect(live()).toBe(false);

    const teardown = registerLiveQueryDevtoolsRepository(repository);

    expect(live()).toBe(true);

    teardown();

    expect(live()).toBe(false);
  });

  it('should track each repository on its own', () => {
    const kept = fakeRepository();
    const dropped = fakeRepository();
    const keepAlive = registerLiveQueryDevtoolsRepository(kept);

    registerLiveQueryDevtoolsRepository(dropped)();

    expect(isQueryDevtoolsRepositoryLive(kept)).toBe(true);
    expect(isQueryDevtoolsRepositoryLive(dropped)).toBe(false);

    keepAlive();
  });
});
