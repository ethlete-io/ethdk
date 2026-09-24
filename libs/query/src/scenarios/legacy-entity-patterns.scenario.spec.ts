import { Component, inject, InjectionToken, Injector, signal, WritableSignal } from '@angular/core';
import { Paginated } from '@ethlete/types';
import { describe, expect, it } from 'vitest';
import {
  createLegacyQueryCreator,
  def,
  EntityStore,
  mapToPaginated,
  paginatedEntityValueUpdater,
  queryComputed,
  queryStateResponseSignal,
  removeFrom,
  V2QueryClient,
} from '../index';
import { LEGACY_CLIENT_KINDS, LegacyClientCreator, LegacyClientKind, Scenario, useScenario } from './harness';

type Layout = { id: string; name: string; collectionId: string };
type ListArgs = { pathParams: { collectionId: string }; queryParams: { page: number } };
type RenameArgs = { pathParams: { id: string }; body: { name: string } };

type Creators = {
  getLayouts: LegacyClientCreator<ListArgs>;
  renameLayout: LegacyClientCreator<RenameArgs>;
  destroy: () => void;
};

const CREATORS = new InjectionToken<Creators>('CREATORS');
const COLLECTION = new InjectionToken<WritableSignal<string>>('COLLECTION');
const CLIENT_KIND = new InjectionToken<LegacyClientKind>('CLIENT_KIND');

const layoutEntities = (store: EntityStore<Layout>) => ({
  list: {
    store,
    id: ({ response }: { response: Paginated<Layout> }) => response.items.map((layout) => layout.id),
    get: ({ response, id, store }: { response: Paginated<Layout>; id: string[]; store: EntityStore<Layout> }) =>
      store.select(id).pipe(mapToPaginated(response)),
    set: ({ response, id, store }: { response: Paginated<Layout>; id: string[]; store: EntityStore<Layout> }) =>
      store.set(id, response.items),
  },
  single: {
    store,
    id: ({ response }: { response: Layout }) => response.id,
    get: ({ id, store }: { id: string; store: EntityStore<Layout> }) => store.select(id),
    set: ({ response, id, store }: { response: Layout; id: string; store: EntityStore<Layout> }) =>
      store.set(id, response),
  },
});

const createCreators = (s: Scenario, kind: LegacyClientKind, store: EntityStore<Layout>): Creators => {
  const entity = layoutEntities(store);

  if (kind === 'interop') {
    return {
      getLayouts: createLegacyQueryCreator({
        creator: s.get<{ response: Paginated<Layout> } & ListArgs>((p) => `/collections/${p.collectionId}/layouts`),
        name: 'getLayouts',
        entity: entity.list as never,
      }) as unknown as LegacyClientCreator<ListArgs>,
      renameLayout: createLegacyQueryCreator({
        creator: s.post<{ response: Layout } & RenameArgs>((p) => `/layouts/${p.id}`),
        name: 'renameLayout',
        entity: entity.single as never,
      }) as unknown as LegacyClientCreator<RenameArgs>,
      destroy: () => undefined,
    };
  }

  const owner = s.consumer();
  const client = owner.run(() => new V2QueryClient({ baseRoute: 'https://api.test' }));

  return {
    getLayouts: client.get({
      route: (p: ListArgs['pathParams']) => `/collections/${p.collectionId}/layouts` as const,
      types: { args: def<ListArgs>(), response: def<Paginated<Layout>>() },
      entity: entity.list as never,
    }) as unknown as LegacyClientCreator<ListArgs>,
    renameLayout: client.post({
      route: (p: RenameArgs['pathParams']) => `/layouts/${p.id}` as const,
      types: { args: def<RenameArgs>(), response: def<Layout>() },
      entity: entity.single as never,
    }) as unknown as LegacyClientCreator<RenameArgs>,
    destroy: () => {
      client._store.forEach((query, key) => {
        query.abort();
        client._store.remove(key);
      });
      owner.destroy();
    },
  };
};

@Component({ template: '' })
class LayoutManagerHost {
  private readonly creators = inject(CREATORS);
  private readonly collectionId = inject(COLLECTION);
  private readonly injector = inject(CLIENT_KIND) === 'interop' ? inject(Injector) : undefined;

  readonly layoutsQuery = queryComputed(() =>
    this.creators.getLayouts
      .prepare({ pathParams: { collectionId: this.collectionId() }, queryParams: { page: 1 } })
      .execute(),
  );
  readonly layouts = queryStateResponseSignal(this.layoutsQuery) as () => Paginated<Layout> | null;

  rename(id: string, name: string) {
    this.creators.renameLayout
      .prepare({ pathParams: { id }, body: { name }, ...(this.injector && { injector: this.injector }) })
      .execute();
  }
}

const page = (items: Layout[]): Paginated<Layout> => ({
  items,
  currentPage: 1,
  nextPage: null,
  itemsPerPage: 10,
  totalHits: items.length,
  totalPageCount: 1,
});

const names = (response: Paginated<Layout> | null) => (response?.items ?? []).map((layout) => layout.name).join(',');

describe.each(LEGACY_CLIENT_KINDS)('legacy entity patterns on the %s client', (kind) => {
  describe('a paginated list read through mapToPaginated from a shared entity store', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('shows a renamed item in the list without a refetch, per collection', () => {
      const s = scenario();
      const layouts: Record<string, Layout[]> = {
        c1: [
          { id: 'a', name: 'A', collectionId: 'c1' },
          { id: 'b', name: 'B', collectionId: 'c1' },
        ],
        c2: [{ id: 'c', name: 'C', collectionId: 'c2' }],
        c3: [{ id: 'd', name: 'D', collectionId: 'c3' }],
      };
      s.api.on('GET', '/collections/:collectionId/layouts', ({ params }) => ({
        body: page(layouts[params['collectionId'] as string] ?? []),
        delay: 50,
      }));
      s.api.on('POST', '/layouts/:id', ({ params, body }) => {
        const id = params['id'] as string;
        const collection = Object.values(layouts).find((items) => items.some((layout) => layout.id === id)) ?? [];
        const index = collection.findIndex((layout) => layout.id === id);
        const renamed = { ...collection[index], name: (body as { name: string }).name } as Layout;

        collection[index] = renamed;

        return { body: renamed, delay: 50 };
      });

      const store = new EntityStore<Layout>({ name: 'broadcastCollectionLayout' });
      const creators = createCreators(s, kind, store);
      const collectionId = signal('c1');
      const c = s.consumer([
        { provide: CREATORS, useValue: creators },
        { provide: COLLECTION, useValue: collectionId },
        { provide: CLIENT_KIND, useValue: kind },
      ]);
      const ref = s.mount(LayoutManagerHost, c.injector);

      s.tick(1000);
      expect(names(ref.instance.layouts())).toBe('A,B');
      expect(ref.instance.layouts()).toMatchObject({ totalHits: 2, currentPage: 1 });

      ref.instance.rename('b', 'B2');
      s.tick(1000);
      expect(names(ref.instance.layouts())).toBe('A,B2');

      for (const [next, id, expected] of [
        ['c2', 'c', 'C2'],
        ['c3', 'd', 'D2'],
        ['c1', 'a', 'A2,B2'],
      ] as const) {
        collectionId.set(next);
        s.tick(1000);

        ref.instance.rename(id, `${id.toUpperCase()}2`);
        s.tick(1000);
        expect(names(ref.instance.layouts())).toBe(expected);
      }

      expect(s.api.requestCount('GET', '/collections/c1/layouts')).toBe(2);
      expect(s.api.requestCount('GET', '/collections/c2/layouts')).toBe(1);
      expect(s.api.requestCount('GET', '/collections/c3/layouts')).toBe(1);
      expect(s.api.requests.filter((request) => request.method === 'POST')).toHaveLength(4);

      removeFrom(store, { where: (layout) => layout.collectionId === 'c1', id: (layout) => layout.id });
      s.tick(10);
      expect(store._dictionary.has('a')).toBe(false);
      expect(store._dictionary.has('b')).toBe(false);
      expect(store._dictionary.has('c')).toBe(true);

      ref.destroy();
      c.destroy();
      creators.destroy();
    });
  });
});

describe('paginatedEntityValueUpdater', () => {
  it('swaps the matching item in both the mapped and the raw page, and reports a miss as null', () => {
    const raw = page([
      { id: 'a', name: 'A', collectionId: 'c1' },
      { id: 'b', name: 'B', collectionId: 'c1' },
    ]);
    const update = paginatedEntityValueUpdater<Paginated<Layout>, ListArgs, Layout, Layout>(
      (item, entity) => item.id === entity.id,
    );
    const args = { pathParams: { collectionId: 'c1' }, queryParams: { page: 1 } };

    const updated = update({
      response: raw,
      rawResponse: raw,
      args,
      entity: { id: 'b', name: 'B2', collectionId: 'c1' },
    });

    expect(names(updated?.response ?? null)).toBe('A,B2');
    expect(names(updated?.rawResponse ?? null)).toBe('A,B2');
    expect(names(raw)).toBe('A,B');
    expect(
      update({ response: raw, rawResponse: raw, args, entity: { id: 'x', name: 'X', collectionId: 'c1' } }),
    ).toBeNull();
  });
});
