# @ethlete/query

## 4.3.1

### Patch Changes

- [`9953965`](https://github.com/ethlete-io/ethdk/commit/99539656b74e5b1448b823d481c50f3c2166b4c0) Thanks [@TomTomB](https://github.com/TomTomB)! - Do not reset unset values to initial ones during query form init

## 4.3.0

### Minor Changes

- [`334b2f7`](https://github.com/ethlete-io/ethdk/commit/334b2f712d5cc31eb474cc6c54742cd99eecc62c) Thanks [@TomTomB](https://github.com/TomTomB)! - Multiple QueryForm enhancements

## 4.2.2

### Patch Changes

- [`febe8b1`](https://github.com/ethlete-io/ethdk/commit/febe8b1fe74e17162cdab261d4ab942fd4b05ac0) Thanks [@TomTomB](https://github.com/TomTomB)! - Ensure version bump because of breaking changes in core

## 4.2.1

### Patch Changes

- [`04e0db6`](https://github.com/ethlete-io/ethdk/commit/04e0db6c0007d58705f88605f3f8ed2d0ad05ce3) Thanks [@TomTomB](https://github.com/TomTomB)! - Update to Angular 16

- [`04e0db6`](https://github.com/ethlete-io/ethdk/commit/04e0db6c0007d58705f88605f3f8ed2d0ad05ce3) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix minor issues within query from

## 4.2.0

### Minor Changes

- [`8f50a5a`](https://github.com/ethlete-io/ethdk/commit/8f50a5af96773f23a1eb53dc01f14498c31a4f98) Thanks [@TomTomB](https://github.com/TomTomB)! - Add EntityStore.selectWhere method

## 4.1.0

### Minor Changes

- [`6dbb74e`](https://github.com/ethlete-io/ethdk/commit/6dbb74ef7eb472bed5f306c01807ecdb3a033089) Thanks [@TomTomB](https://github.com/TomTomB)! - Add `refreshing` property to etQuery directive. This boolean property will only be true, if the query is triggered via polling or auto-refresh.

### Patch Changes

- [`6dbb74e`](https://github.com/ethlete-io/ethdk/commit/6dbb74ef7eb472bed5f306c01807ecdb3a033089) Thanks [@TomTomB](https://github.com/TomTomB)! - Reset etQuery state if query is set to null

## 4.0.1

### Patch Changes

- [`99face5`](https://github.com/ethlete-io/ethdk/commit/99face506b982c2c44a10ecaf47d20a500ef7c7d) Thanks [@TomTomB](https://github.com/TomTomB)! - Don't retry code 500 if it's a requested page out of range error

## 4.0.0

### Major Changes

- [`a82d73f`](https://github.com/ethlete-io/ethdk/commit/a82d73f0bca728c8a58dd3a6b76833bff110b188) Thanks [@TomTomB](https://github.com/TomTomB)! - Return both previous and current value inside query form observe method.

### Minor Changes

- [`49cacbb`](https://github.com/ethlete-io/ethdk/commit/49cacbbedbf5c5c40ebb6cf60400c5ee1766f93f) Thanks [@TomTomB](https://github.com/TomTomB)! - Add resetPageOnError operator for resetting the page control to 1 if the query fails due to the requested page not existing

- [`a82d73f`](https://github.com/ethlete-io/ethdk/commit/a82d73f0bca728c8a58dd3a6b76833bff110b188) Thanks [@TomTomB](https://github.com/TomTomB)! - Add option for resetting a query form field's value if one or more of it's dependencies change (via `isResetBy` prop).

## 3.0.4

### Patch Changes

- [`b5cd43c`](https://github.com/ethlete-io/ethdk/commit/b5cd43cf9b9156a980dd2e5f08fad39ecd0102aa) Thanks [@TomTomB](https://github.com/TomTomB)! - Update querie's entity store before dispatching a success state

## 3.0.3

### Patch Changes

- [`bcdcbda`](https://github.com/ethlete-io/ethdk/commit/bcdcbda5ed5a3a72be8607ced8af8342ad509df8) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix typings for response in query directive

## 3.0.2

### Patch Changes

- [`ee1ca9c`](https://github.com/ethlete-io/ethdk/commit/ee1ca9c406d7ef3095d8e93af1e40f0d160036e6) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix typings for query pipe operators

## 3.0.1

### Patch Changes

- [`ce19688`](https://github.com/ethlete-io/ethdk/commit/ce19688fc4003a69968afb6aeb737fb7186f24ff) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix infinityQuery property names

## 3.0.0

### Major Changes

- [#590](https://github.com/ethlete-io/ethdk/pull/590) [`bfd8658`](https://github.com/ethlete-io/ethdk/commit/bfd8658b344a5a410d89d701eb69ae8aa7a8a0b9) Thanks [@TomTomB](https://github.com/TomTomB)! - This release includes the following **breaking** changes:

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
  - `Query.state` property has been removed. Use `state# @ethlete/query or `rawState` instead.

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

## 2.9.2

### Patch Changes

- [`75276a3`](https://github.com/ethlete-io/ethdk/commit/75276a3e35c75ea05ab5600a25c0ca2f8f5350ef) Thanks [@TomTomB](https://github.com/TomTomB)! - Keep infinity queries inside the loading state until the first data has arrived

## 2.9.1

### Patch Changes

- [`37d8c02`](https://github.com/ethlete-io/ethdk/commit/37d8c02dee279c1d7a6f872818d46c030cda7254) Thanks [@TomTomB](https://github.com/TomTomB)! - Add missing failure case for queries

## 2.9.0

### Minor Changes

- [`081e1ef`](https://github.com/ethlete-io/ethdk/commit/081e1efc6b1f0a26dc71f3a579ee77583dc3b3fa) Thanks [@TomTomB](https://github.com/TomTomB)! - Add logic for auto refreshing a jwt if a query's response is 401

## 2.8.0

### Minor Changes

- [`c2fab58`](https://github.com/ethlete-io/ethdk/commit/c2fab5800bac9162efd9920590830e3bd6194714) Thanks [@TomTomB](https://github.com/TomTomB)! - Expose DelayableDirective inside infinity query

## 2.7.3

### Patch Changes

- [`da1c1d1`](https://github.com/ethlete-io/ethdk/commit/da1c1d1e80b2543f27b67c3b18ddd37acaea97dc) Thanks [@TomTomB](https://github.com/TomTomB)! - Make infinity query trigger less depended on a full intersection threshold

## 2.7.2

### Patch Changes

- [`c7fb88e`](https://github.com/ethlete-io/ethdk/commit/c7fb88ed6a1539b147386fef6a9b4777b2467858) Thanks [@TomTomB](https://github.com/TomTomB)! - Dont cache xhr partial state to prevent it from becomming stale during file uploads

- [`113aca5`](https://github.com/ethlete-io/ethdk/commit/113aca5244e4cb61602a3e86950c538d82fe85d3) Thanks [@TomTomB](https://github.com/TomTomB)! - Do not update a query by entity if keys dont match

## 2.7.1

### Patch Changes

- [`9e9c073`](https://github.com/ethlete-io/ethdk/commit/9e9c073e7c32d408530657f32e11ed1a26b16425) Thanks [@TomTomB](https://github.com/TomTomB)! - Remove auto refresh logic from infinity query

## 2.7.0

### Minor Changes

- [`2e8a912`](https://github.com/ethlete-io/ethdk/commit/2e8a9122e82fdb812f11570fc112b0c6c774c013) Thanks [@TomTomB](https://github.com/TomTomB)! - Add support for nested objects inside query params

### Patch Changes

- [`07493d0`](https://github.com/ethlete-io/ethdk/commit/07493d03827c3f004c9e4446bf4ef0fd43540ac9) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix logic for updating query entities

## 2.6.0

### Minor Changes

- [`924a187`](https://github.com/ethlete-io/ethdk/commit/924a1876be04ac1112d0557a9d5f4753908c9e9e) Thanks [@TomTomB](https://github.com/TomTomB)! - Add support for query entity stores inside infinity queries

- [`d3765b7`](https://github.com/ethlete-io/ethdk/commit/d3765b75d59fc218f9aa03feb2398adb1fc4a7dd) Thanks [@TomTomB](https://github.com/TomTomB)! - Add query entity store to share responses between queries

## 2.5.4

### Patch Changes

- [`274a884`](https://github.com/ethlete-io/ethdk/commit/274a8842e30f9f94074187295602bc9a9376dc43) Thanks [@TomTomB](https://github.com/TomTomB)! - Only set auth cookie if option is enabled in BearerAuthProvider

## 2.5.3

### Patch Changes

- [`50e5ebb`](https://github.com/ethlete-io/ethdk/commit/50e5ebb287beb9c3287b4a56cc27d3b679ef2fc5) Thanks [@TomTomB](https://github.com/TomTomB)! - Dont debounce query form value updates triggered by methods from within QueryForm class

- [`34151d1`](https://github.com/ethlete-io/ethdk/commit/34151d177053484786d509c401cb102e27867360) Thanks [@TomTomB](https://github.com/TomTomB)! - Dont run the next polling request if the current one is still in a loading state

## 2.5.2

### Patch Changes

- [`9713ae1`](https://github.com/ethlete-io/ethdk/commit/9713ae1df223a735db2aaa87300738e4680614d6) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix gql method header not getting set correctly if only a default option is provided inside the query client

## 2.5.1

### Patch Changes

- [`39f82fb`](https://github.com/ethlete-io/ethdk/commit/39f82fb2bb6d24889509fc54984c3ba59b2d14be) Thanks [@TomTomB](https://github.com/TomTomB)! - Dont auto exec a query inside prepare if its expired

## 2.5.0

### Minor Changes

- [`088e0ea`](https://github.com/ethlete-io/ethdk/commit/088e0eaf63ab03547b50b1a981aa770564b07a47) Thanks [@TomTomB](https://github.com/TomTomB)! - Add option to query client to set a default value for gql `transferVia` option

## 2.4.0

### Minor Changes

- [`7085907`](https://github.com/ethlete-io/ethdk/commit/7085907686f2f334343e9a0c64c7f44e49ad0459) Thanks [@TomTomB](https://github.com/TomTomB)! - Allow gql calls to be send via GET

### Patch Changes

- [`7085907`](https://github.com/ethlete-io/ethdk/commit/7085907686f2f334343e9a0c64c7f44e49ad0459) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix polling breaking if the observable gets completed via take until operator

## 2.3.0

### Minor Changes

- [`ae9513d`](https://github.com/ethlete-io/ethdk/commit/ae9513df590ba576e37d1d084ddd8c794a2d46f3) Thanks [@TomTomB](https://github.com/TomTomB)! - Add utils to detect query state auto refresh events

- [`166f0cb`](https://github.com/ethlete-io/ethdk/commit/166f0cb368738282520dbe5df1804bb1263ff0ac) Thanks [@TomTomB](https://github.com/TomTomB)! - Add util to cast query creator types

### Patch Changes

- [`f090bfa`](https://github.com/ethlete-io/ethdk/commit/f090bfab99481d1bdbcc07cb06943386fb6cb074) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix infinity query instance typings

- [`d607a9c`](https://github.com/ethlete-io/ethdk/commit/d607a9c778839df28871c79219a66fdc20605c7b) Thanks [@TomTomB](https://github.com/TomTomB)! - Debounce smart polling and auto refresh on window focus

## 2.2.0

### Minor Changes

- [`233899b`](https://github.com/ethlete-io/ethdk/commit/233899be8d4798cdc0f1bc117fd4ebc2f3bc61d3) Thanks [@TomTomB](https://github.com/TomTomB)! - Retry failed queries if possible and provide api to customize the retry fn

## 2.1.1

### Patch Changes

- [`de7545f`](https://github.com/ethlete-io/ethdk/commit/de7545f5b2935e8d1721810291ac22ed0dc78928) Thanks [@TomTomB](https://github.com/TomTomB)! - Dont ignore max age if age is not send

## 2.1.0

### Minor Changes

- [`0be7785`](https://github.com/ethlete-io/ethdk/commit/0be77857c9628704a6a89eebfa7046c0093411c2) Thanks [@TomTomB](https://github.com/TomTomB)! - Smart polling and auto refresh on window focus

- [`804b664`](https://github.com/ethlete-io/ethdk/commit/804b6648dc6a2c005c1a67d63dd1d86c9737a487) Thanks [@TomTomB](https://github.com/TomTomB)! - Auto reset infinity query if query gets auto refreshed

### Patch Changes

- [`804b664`](https://github.com/ethlete-io/ethdk/commit/804b6648dc6a2c005c1a67d63dd1d86c9737a487) Thanks [@TomTomB](https://github.com/TomTomB)! - Auto load the first page after an infinity query gets reset

## 2.0.0

### Major Changes

- [`2c224de`](https://github.com/ethlete-io/ethdk/commit/2c224de02972e80b53c02cc6e68e9db450c6ef7f) Thanks [@TomTomB](https://github.com/TomTomB)! - Add functionality to auto refresh queries that can be cached, if their query client's default headers get updated.

  `QueryClient.setDefaultHeaders()` now accepts a configuration object instead of a headers map.

  Before:

  ```ts
  QueryClient.setDefaultHeaders({ 'X-My-Header': 'Some Value' });
  ```

  After:

  ```ts
  QueryClient.setDefaultHeaders({ headers: { 'X-My-Header': 'Some Value' } });
  ```

## 1.0.1

### Patch Changes

- [#482](https://github.com/ethlete-io/ethdk/pull/482) [`9ee061c`](https://github.com/ethlete-io/ethdk/commit/9ee061cf527fc27aecf5769388d794b3d849c671) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix content type for gql queries

## 1.0.0

### Major Changes

- [#475](https://github.com/ethlete-io/ethdk/pull/475) [`44ac6e6`](https://github.com/ethlete-io/ethdk/commit/44ac6e621c9b2c2e02b45f7abc2c1b3111604d56) Thanks [@TomTomB](https://github.com/TomTomB)! - Initial stable release

### Minor Changes

- [#475](https://github.com/ethlete-io/ethdk/pull/475) [`07f1299`](https://github.com/ethlete-io/ethdk/commit/07f12998d921e69ff51fed4b0dfd5514842e8e12) Thanks [@TomTomB](https://github.com/TomTomB)! - Add option to set default headers in query client

- [#475](https://github.com/ethlete-io/ethdk/pull/475) [`b8199f0`](https://github.com/ethlete-io/ethdk/commit/b8199f0534c466d2f022a6ba754c55818aa7b863) Thanks [@TomTomB](https://github.com/TomTomB)! - Support sending refresh token via query param

- [#418](https://github.com/ethlete-io/ethdk/pull/418) [`79c6748`](https://github.com/ethlete-io/ethdk/commit/79c6748695d669ac095e1411f76da2d03a12c3ec) Thanks [@nziermann](https://github.com/nziermann)! - Use query creator inside bearer auth provider

- [#418](https://github.com/ethlete-io/ethdk/pull/418) [`7dbbde9`](https://github.com/ethlete-io/ethdk/commit/7dbbde9617936ae95993cb9197430be73a5b6f2e) Thanks [@nziermann](https://github.com/nziermann)! - Add switchQueryCollectionState util

- [#418](https://github.com/ethlete-io/ethdk/pull/418) [`e27ab4a`](https://github.com/ethlete-io/ethdk/commit/e27ab4ae937be25f6e11d736cd6e3e82dab0aac1) Thanks [@nziermann](https://github.com/nziermann)! - Add option to toggle auth cookie saving

- [#418](https://github.com/ethlete-io/ethdk/pull/418) [`642273d`](https://github.com/ethlete-io/ethdk/commit/642273d483e5bc49bd2cbca33ebf51aefe757c8f) Thanks [@nziermann](https://github.com/nziermann)! - Add QueryCollections

- [#135](https://github.com/ethlete-io/ethdk/pull/135) [`8f303dd`](https://github.com/ethlete-io/ethdk/commit/8f303dd8764358cb21525f198bf1bb2aee5eb504) Thanks [@TomTomB](https://github.com/TomTomB)! - Initial release of query package

- [#418](https://github.com/ethlete-io/ethdk/pull/418) [`1cef898`](https://github.com/ethlete-io/ethdk/commit/1cef898de339aeea3f748b5e4daa289a89021b2e) Thanks [@nziermann](https://github.com/nziermann)! - Allow setting a cookie for bearer auth provider

- [#433](https://github.com/ethlete-io/ethdk/pull/433) [`6f44f18`](https://github.com/ethlete-io/ethdk/commit/6f44f18105223c60736baa0dc025cab4f64b90ff) Thanks [@nziermann](https://github.com/nziermann)! - Use XHR instead of fetch to support progress events

- [#475](https://github.com/ethlete-io/ethdk/pull/475) [`0189154`](https://github.com/ethlete-io/ethdk/commit/0189154fd09edf99ee50425e5e2abc821f474f63) Thanks [@TomTomB](https://github.com/TomTomB)! - Add additional rxjs query utils

- [#469](https://github.com/ethlete-io/ethdk/pull/469) [`8997ebc`](https://github.com/ethlete-io/ethdk/commit/8997ebc2ebf17fa1dbc1736ed03abbb31f11e284) Thanks [@nziermann](https://github.com/nziermann)! - Allow setting a parent query client to share state

- [#475](https://github.com/ethlete-io/ethdk/pull/475) [`24bd842`](https://github.com/ethlete-io/ethdk/commit/24bd8423017f22c9ef77e23aa520ca50a3ebfaa9) Thanks [@TomTomB](https://github.com/TomTomB)! - Add option to parse query form value to query param string and add utils for handling this case with sort controls

- [#475](https://github.com/ethlete-io/ethdk/pull/475) [`f3ae592`](https://github.com/ethlete-io/ethdk/commit/f3ae592715d82aab5ba73d5e531c92ecd63a654f) Thanks [@TomTomB](https://github.com/TomTomB)! - Add useResultIn property to query prepare function

### Patch Changes

- [#446](https://github.com/ethlete-io/ethdk/pull/446) [`55e5ce0`](https://github.com/ethlete-io/ethdk/commit/55e5ce0ab57e6af238b48145e8e0d0c088b51583) Thanks [@nziermann](https://github.com/nziermann)! - Fix request error typings

- [#475](https://github.com/ethlete-io/ethdk/pull/475) [`97cca42`](https://github.com/ethlete-io/ethdk/commit/97cca42651cff2e724fd8bf44f1f8fe59b5e1775) Thanks [@TomTomB](https://github.com/TomTomB)! - Check content type before using resp.json

- [#418](https://github.com/ethlete-io/ethdk/pull/418) [`2ebeec4`](https://github.com/ethlete-io/ethdk/commit/2ebeec4f6af02aa12db97e12156b396d20904584) Thanks [@nziermann](https://github.com/nziermann)! - Minor enhancements inside bearer auth provider

- [#475](https://github.com/ethlete-io/ethdk/pull/475) [`96ac0f7`](https://github.com/ethlete-io/ethdk/commit/96ac0f732ef98a14c271fd74881199008259c9f4) Thanks [@TomTomB](https://github.com/TomTomB)! - Expose infinity query data inside directive as observable

- [#475](https://github.com/ethlete-io/ethdk/pull/475) [`bb84d96`](https://github.com/ethlete-io/ethdk/commit/bb84d96f1e895bc68a3bfb484daa4aea6dc8b2d0) Thanks [@TomTomB](https://github.com/TomTomB)! - Cleanup infinity query diective context on config change

- [#418](https://github.com/ethlete-io/ethdk/pull/418) [`e72926b`](https://github.com/ethlete-io/ethdk/commit/e72926bb0f72bc2fa52f58d73fddc6897dbdb8c5) Thanks [@nziermann](https://github.com/nziermann)! - Do not set the form data header automatically

- [#446](https://github.com/ethlete-io/ethdk/pull/446) [`44a3a4d`](https://github.com/ethlete-io/ethdk/commit/44a3a4d40f1aac95bd6599574a2b94d2dc64ab84) Thanks [@nziermann](https://github.com/nziermann)! - Dont trie to load pages greater than total pages in infinity query and raise an error instead

- [#475](https://github.com/ethlete-io/ethdk/pull/475) [`464addd`](https://github.com/ethlete-io/ethdk/commit/464adddc40be75e60b9102a76822c9aeecf4e7f8) Thanks [@TomTomB](https://github.com/TomTomB)! - Add option for refresh attemmpts

- [#475](https://github.com/ethlete-io/ethdk/pull/475) [`8a65dfd`](https://github.com/ethlete-io/ethdk/commit/8a65dfd3a4d9a8e1eb8fa723c540c2070dd4813a) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix bearer auto refresh only working 1 time

- [#475](https://github.com/ethlete-io/ethdk/pull/475) [`93b349d`](https://github.com/ethlete-io/ethdk/commit/93b349dc0329ab8829e5566866f07a2c8b967928) Thanks [@TomTomB](https://github.com/TomTomB)! - Only freeze actual response objects

- [#475](https://github.com/ethlete-io/ethdk/pull/475) [`799bd27`](https://github.com/ethlete-io/ethdk/commit/799bd2702a36536ac2a8306be93ee91e32934679) Thanks [@TomTomB](https://github.com/TomTomB)! - Allow null to be passed into fulterSuccess and filterFailure

- [#446](https://github.com/ethlete-io/ethdk/pull/446) [`46db6e3`](https://github.com/ethlete-io/ethdk/commit/46db6e3694b2eeda837b77d836cbeeed72f9768d) Thanks [@nziermann](https://github.com/nziermann)! - Fix the content type header getting set to text/plain even if it is json

- [#475](https://github.com/ethlete-io/ethdk/pull/475) [`24bd842`](https://github.com/ethlete-io/ethdk/commit/24bd8423017f22c9ef77e23aa520ca50a3ebfaa9) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix query form change event getting triggered twice for each change

- [#475](https://github.com/ethlete-io/ethdk/pull/475) [`a951b6e`](https://github.com/ethlete-io/ethdk/commit/a951b6e9ffd80fd2ad2a546d39fbcef7fcee96cf) Thanks [@TomTomB](https://github.com/TomTomB)! - Add missing exportAs to infinityQuery directive

- [#475](https://github.com/ethlete-io/ethdk/pull/475) [`8407fb2`](https://github.com/ethlete-io/ethdk/commit/8407fb25560e7c835deda0371fc68187760b19c4) Thanks [@TomTomB](https://github.com/TomTomB)! - Try to parse error fetch response as json before defaulting to plain text

- [#475](https://github.com/ethlete-io/ethdk/pull/475) [`1327af1`](https://github.com/ethlete-io/ethdk/commit/1327af13c721f8fe26d53bd12abd17e93d62bee5) Thanks [@TomTomB](https://github.com/TomTomB)! - Dependency updates

- [#418](https://github.com/ethlete-io/ethdk/pull/418) [`0ce1f51`](https://github.com/ethlete-io/ethdk/commit/0ce1f51b0ffe8b69f2774d283bab8fa3b3d10c91) Thanks [@nziermann](https://github.com/nziermann)! - Use faster versions of cloning and comparing objects

- [#475](https://github.com/ethlete-io/ethdk/pull/475) [`11c1d1a`](https://github.com/ethlete-io/ethdk/commit/11c1d1a972d8d2b12dc9709b593952d27485502f) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix content type guessing using the wrong body var

- [#475](https://github.com/ethlete-io/ethdk/pull/475) [`5dcfe0e`](https://github.com/ethlete-io/ethdk/commit/5dcfe0eef2d0dc6a1d5404787d3f87dff3d6072e) Thanks [@TomTomB](https://github.com/TomTomB)! - Append request init and route to request error object

- [#418](https://github.com/ethlete-io/ethdk/pull/418) [`ef05e84`](https://github.com/ethlete-io/ethdk/commit/ef05e84e96c97f7c2c8462246ca33b822f61381d) Thanks [@nziermann](https://github.com/nziermann)! - Fix FormData query body getting parsed as json

## 0.1.0-next.26

### Minor Changes

- [#469](https://github.com/ethlete-io/ethdk/pull/469) [`8997ebc`](https://github.com/ethlete-io/ethdk/commit/8997ebc2ebf17fa1dbc1736ed03abbb31f11e284) Thanks [@nziermann](https://github.com/nziermann)! - Allow setting a parent query client to share state

## 0.1.0-next.25

### Patch Changes

- [`55e5ce0`](https://github.com/ethlete-io/ethdk/commit/55e5ce0ab57e6af238b48145e8e0d0c088b51583) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix request error typings

## 0.1.0-next.24

### Patch Changes

- [`44a3a4d`](https://github.com/ethlete-io/ethdk/commit/44a3a4d40f1aac95bd6599574a2b94d2dc64ab84) Thanks [@TomTomB](https://github.com/TomTomB)! - Dont trie to load pages greater than total pages in infinity query and raise an error instead

## 0.1.0-next.23

### Patch Changes

- [`46db6e3`](https://github.com/ethlete-io/ethdk/commit/46db6e3694b2eeda837b77d836cbeeed72f9768d) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix the content type header getting set to text/plain even if it is json

## 0.1.0-next.22

### Minor Changes

- [`6f44f18`](https://github.com/ethlete-io/ethdk/commit/6f44f18105223c60736baa0dc025cab4f64b90ff) Thanks [@TomTomB](https://github.com/TomTomB)! - Use XHR instead of fetch to support progress events

## 0.1.0-next.21

### Patch Changes

- [`0ce1f51`](https://github.com/ethlete-io/ethdk/commit/0ce1f51b0ffe8b69f2774d283bab8fa3b3d10c91) Thanks [@TomTomB](https://github.com/TomTomB)! - Use faster versions of cloning and comparing objects

## 0.1.0-next.20

### Minor Changes

- [`7dbbde9`](https://github.com/ethlete-io/ethdk/commit/7dbbde9617936ae95993cb9197430be73a5b6f2e) Thanks [@TomTomB](https://github.com/TomTomB)! - Add switchQueryCollectionState util

## 0.1.0-next.19

### Minor Changes

- [`e27ab4a`](https://github.com/ethlete-io/ethdk/commit/e27ab4ae937be25f6e11d736cd6e3e82dab0aac1) Thanks [@TomTomB](https://github.com/TomTomB)! - Add option to toggle auth cookie saving

## 0.1.0-next.18

### Patch Changes

- [`2ebeec4`](https://github.com/ethlete-io/ethdk/commit/2ebeec4f6af02aa12db97e12156b396d20904584) Thanks [@TomTomB](https://github.com/TomTomB)! - Minor enhancements inside bearer auth provider

## 0.1.0-next.17

### Minor Changes

- [`79c6748`](https://github.com/ethlete-io/ethdk/commit/79c6748695d669ac095e1411f76da2d03a12c3ec) Thanks [@TomTomB](https://github.com/TomTomB)! - Use query creator inside bearer auth provider

## 0.1.0-next.16

### Minor Changes

- [`1cef898`](https://github.com/ethlete-io/ethdk/commit/1cef898de339aeea3f748b5e4daa289a89021b2e) Thanks [@TomTomB](https://github.com/TomTomB)! - Allow setting a cookie for bearer auth provider

## 0.1.0-next.15

### Patch Changes

- [`e72926b`](https://github.com/ethlete-io/ethdk/commit/e72926bb0f72bc2fa52f58d73fddc6897dbdb8c5) Thanks [@TomTomB](https://github.com/TomTomB)! - Do not set the form data header automatically

## 0.1.0-next.14

### Patch Changes

- [`ef05e84`](https://github.com/ethlete-io/ethdk/commit/ef05e84e96c97f7c2c8462246ca33b822f61381d) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix FormData query body getting parsed as json

## 0.1.0-next.13

### Minor Changes

- [#303](https://github.com/ethlete-io/ethdk/pull/303) [`642273d`](https://github.com/ethlete-io/ethdk/commit/642273d483e5bc49bd2cbca33ebf51aefe757c8f) Thanks [@renovate](https://github.com/apps/renovate)! - Add QueryCollections

## 0.1.0-next.12

### Patch Changes

- [`464addd`](https://github.com/ethlete-io/ethdk/commit/464adddc40be75e60b9102a76822c9aeecf4e7f8) Thanks [@TomTomB](https://github.com/TomTomB)! - Add option for refresh attemmpts

- [`8a65dfd`](https://github.com/ethlete-io/ethdk/commit/8a65dfd3a4d9a8e1eb8fa723c540c2070dd4813a) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix bearer auto refresh only working 1 time

## 0.1.0-next.11

### Minor Changes

- [#193](https://github.com/ethlete-io/ethdk/pull/193) [`b8199f0`](https://github.com/ethlete-io/ethdk/commit/b8199f0534c466d2f022a6ba754c55818aa7b863) Thanks [@renovate](https://github.com/apps/renovate)! - Support sending refresh token via query param

- [#193](https://github.com/ethlete-io/ethdk/pull/193) [`f3ae592`](https://github.com/ethlete-io/ethdk/commit/f3ae592715d82aab5ba73d5e531c92ecd63a654f) Thanks [@renovate](https://github.com/apps/renovate)! - Add useResultIn property to query prepare function

### Patch Changes

- [`1327af1`](https://github.com/ethlete-io/ethdk/commit/1327af13c721f8fe26d53bd12abd17e93d62bee5) Thanks [@TomTomB](https://github.com/TomTomB)! - Dependency updates

## 0.1.0-next.10

### Minor Changes

- [`0189154`](https://github.com/ethlete-io/ethdk/commit/0189154fd09edf99ee50425e5e2abc821f474f63) Thanks [@TomTomB](https://github.com/TomTomB)! - Add additional rxjs query utils

## 0.1.0-next.9

### Patch Changes

- [`799bd27`](https://github.com/ethlete-io/ethdk/commit/799bd2702a36536ac2a8306be93ee91e32934679) Thanks [@TomTomB](https://github.com/TomTomB)! - Allow null to be passed into fulterSuccess and filterFailure

## 0.1.0-next.8

### Patch Changes

- [#193](https://github.com/ethlete-io/ethdk/pull/193) [`8407fb2`](https://github.com/ethlete-io/ethdk/commit/8407fb25560e7c835deda0371fc68187760b19c4) Thanks [@renovate](https://github.com/apps/renovate)! - Try to parse error fetch response as json before defaulting to plain text

## 0.1.0-next.7

### Patch Changes

- [`97cca42`](https://github.com/ethlete-io/ethdk/commit/97cca42651cff2e724fd8bf44f1f8fe59b5e1775) Thanks [@TomTomB](https://github.com/TomTomB)! - Check content type before using resp.json

## 0.1.0-next.6

### Patch Changes

- [`93b349d`](https://github.com/ethlete-io/ethdk/commit/93b349dc0329ab8829e5566866f07a2c8b967928) Thanks [@TomTomB](https://github.com/TomTomB)! - Only freeze actual response objects

## 0.1.0-next.5

### Patch Changes

- [#185](https://github.com/ethlete-io/ethdk/pull/185) [`bb84d96`](https://github.com/ethlete-io/ethdk/commit/bb84d96f1e895bc68a3bfb484daa4aea6dc8b2d0) Thanks [@github-actions](https://github.com/apps/github-actions)! - Cleanup infinity query diective context on config change

- [`a951b6e`](https://github.com/ethlete-io/ethdk/commit/a951b6e9ffd80fd2ad2a546d39fbcef7fcee96cf) Thanks [@TomTomB](https://github.com/TomTomB)! - Add missing exportAs to infinityQuery directive

## 0.1.0-next.4

### Patch Changes

- [`96ac0f7`](https://github.com/ethlete-io/ethdk/commit/96ac0f732ef98a14c271fd74881199008259c9f4) Thanks [@TomTomB](https://github.com/TomTomB)! - Expose infinity query data inside directive as observable

## 0.1.0-next.3

### Minor Changes

- [`24bd842`](https://github.com/ethlete-io/ethdk/commit/24bd8423017f22c9ef77e23aa520ca50a3ebfaa9) Thanks [@TomTomB](https://github.com/TomTomB)! - Add option to parse query form value to query param string and add utils for handling this case with sort controls

### Patch Changes

- [`24bd842`](https://github.com/ethlete-io/ethdk/commit/24bd8423017f22c9ef77e23aa520ca50a3ebfaa9) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix query form change event getting triggered twice for each change

## 0.1.0-next.2

### Patch Changes

- [`5dcfe0e`](https://github.com/ethlete-io/ethdk/commit/5dcfe0eef2d0dc6a1d5404787d3f87dff3d6072e) Thanks [@TomTomB](https://github.com/TomTomB)! - Append request init and route to request error object

## 0.1.0-next.1

### Patch Changes

- [`11c1d1a`](https://github.com/ethlete-io/ethdk/commit/11c1d1a972d8d2b12dc9709b593952d27485502f) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix content type guessing using the wrong body var

## 0.1.0-next.0

### Minor Changes

- [#135](https://github.com/ethlete-io/ethdk/pull/135) [`8f303dd`](https://github.com/ethlete-io/ethdk/commit/8f303dd8764358cb21525f198bf1bb2aee5eb504) Thanks [@TomTomB](https://github.com/TomTomB)! - Initial release of query package
