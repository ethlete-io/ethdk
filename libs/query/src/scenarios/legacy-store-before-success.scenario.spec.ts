import { InjectionToken } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { createLegacyQueryCreator, def, EntityStore, V2QueryClient } from '../index';
import { LEGACY_CLIENT_KINDS, LegacyClientCreator, LegacyClientKind, Scenario, useScenario } from './harness';

type Item = { id: string; name: string };
type GetItemArgs = { pathParams: { id: string } };

const GET_ITEM = new InjectionToken<LegacyClientCreator<GetItemArgs>>('GET_ITEM');

const itemEntity = (store: EntityStore<Item>) => ({
  store,
  id: ({ response }: { response: Item }) => response.id,
  get: ({ id, store }: { id: string; store: EntityStore<Item> }) => store.select(id),
  set: ({ response, id, store }: { response: Item; id: string; store: EntityStore<Item> }) => store.set(id, response),
});

const createGetItem = (s: Scenario, kind: LegacyClientKind, store: EntityStore<Item>) => {
  const entity = itemEntity(store);

  if (kind === 'interop') {
    return {
      creator: createLegacyQueryCreator({
        creator: s.get<{ response: Item } & GetItemArgs>((p) => `/items/${p.id}`),
        name: 'getItem',
        entity: entity as never,
      }) as unknown as LegacyClientCreator<GetItemArgs>,
      destroy: () => undefined,
    };
  }

  const owner = s.consumer();
  const client = owner.run(() => new V2QueryClient({ baseRoute: 'https://api.test' }));

  return {
    creator: client.get({
      route: (p: GetItemArgs['pathParams']) => `/items/${p.id}` as const,
      types: { args: def<GetItemArgs>(), response: def<Item>() },
      entity: entity as never,
    }) as unknown as LegacyClientCreator<GetItemArgs>,
    destroy: () => {
      client._store.forEach((query, key) => {
        query.abort();
        client._store.remove(key);
      });
      owner.destroy();
    },
  };
};

describe.each(LEGACY_CLIENT_KINDS)('legacy entity write before success on the %s client', (kind) => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  const run = (destroyOnResponse: boolean) => {
    const s = scenario();
    s.api.on('GET', '/items/:id', ({ params }) => ({ body: { id: params['id'], name: 'Item' }, delay: 50 }));

    const store = new EntityStore<Item>({ name: 'storeBeforeSuccess' });
    const { creator, destroy } = createGetItem(s, kind, store);
    const c = s.consumer([{ provide: GET_ITEM, useValue: creator }]);
    const seenInOnSuccess: boolean[] = [];

    c.run(() => {
      const query = c.injector.get(GET_ITEM).prepare({
        pathParams: { id: 'a' },
        injector: c.injector,
        ...(destroyOnResponse && { config: { destroyOnResponse: true } }),
      } as never);

      query.onSuccess(() => seenInOnSuccess.push(store._dictionary.has('a')));
      query.execute();
    });

    s.tick(500);

    return { seenInOnSuccess, store, cleanup: () => (c.destroy(), destroy()) };
  };

  it('has written the response to the store when onSuccess runs', () => {
    const { seenInOnSuccess, store, cleanup } = run(false);

    expect(seenInOnSuccess).toEqual([true]);
    expect(store._dictionary.has('a')).toBe(true);

    cleanup();
  });

  it('has written the response to the store when onSuccess runs on a destroyOnResponse query', () => {
    const { seenInOnSuccess, store, cleanup } = run(true);

    expect(seenInOnSuccess).toEqual([true]);
    expect(store._dictionary.has('a')).toBe(true);

    cleanup();
  });
});
