---
'@ethlete/query': major
---

This release includes the following **breaking** changes:

- `QueryDirective` selector was renamed from `query` to `etQuery`.
- `InfinityQueryDirective` selector was renamed from `infinityQuery` to `etInfinityQuery`.
- `InfinityQueryTriggerDirective` selector was renamed from `infinityQueryTrigger` & `infinity-query-trigger` to `etInfinityQueryTrigger` or `et-infinity-query-trigger`
- `InfinityQueryDirective` `_loadNextPage()` was removed. Use `loadNextPage()` instead.
- `QueryState` `Success` interface - raw response property was removed.
- `QueryCreator` `responseTransformer` option was removed. Supply a store instead and modify the response to your liking using the get function.
- `QueryCreator.prepare` `useResultIn` option was removed. Use a store instead.
- `QueryType` type was renamed to `ConstructQuery`
- `AnyQueryCreatorCollection` type was renamed to `QueryCollectionOf`. For accepting query collections, use the `AnyQueryCollection` type.
- `EntityStore` `idKey` option was removed.
- `QueryCreator` `entity` config has changed. Instead of supplying a `successAction` and a `valueUpdater` function, you now need at least a `id` function + either a `get` or `set` function.
- `Query.state` property has been removed. Use `state$` or `rawState` instead.

Before

```ts
import { EntityStore, def, paginatedEntityValueUpdater } from '@ethlete/query';

const mediaWithDetailsStore = new EntityStore<MediaViewWithDetails>({
  name: 'media',
  idKey: 'uuid',
});

export const getMediaListWithDetails = myClient.get({
  route: '/media/list/with-details',
  secure: true,
  types: {
    args: def<GetMediaListArgs>(),
    response: def<Paginated<MediaViewWithDetails>>(),
  },
  entity: {
    store: mediaWithDetailsStore,
    successAction: ({ response, store }) => store.setMany(response.items),
    valueUpdater: paginatedEntityValueUpdater((v, e) => v.uuid === e.uuid),
  },
});
```

After

```ts
import { EntityStore, def, mapToPaginated } from '@ethlete/query';

const mediaWithDetailsStore = new EntityStore<MediaViewWithDetails>({
  name: 'media',
});

export const getMediaListWithDetails = myClient.get({
  route: '/media/list/with-details',
  secure: true,
  types: {
    args: def<GetMediaListArgs>(),
    response: def<Paginated<MediaViewWithDetails>>(),
  },
  entity: {
    store: mediaWithDetailsStore,
    id: ({ response }) => response.items.map((item) => item.uuid),
    get: ({ store, id, response }) => store.select(id).pipe(mapToPaginated(response)),
    set: ({ store, id, response }) => store.set(id, response.items),
  },
});
```
