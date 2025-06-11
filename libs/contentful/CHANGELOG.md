# @ethlete/contentful

## 3.9.0

### Minor Changes

- [`8816a31`](https://github.com/ethlete-io/ethdk/commit/8816a3184693002fcdc795c81e5f39771ec57c52) Thanks [@TomTomB](https://github.com/TomTomB)! - Add `et-contentful-rich-text-default-element` class to every native html element rendered by the rich text renderer

## 3.8.0

### Minor Changes

- [`10802c0`](https://github.com/ethlete-io/ethdk/commit/10802c0ecef8907b2ab27f42680aa5b47db76f7d) Thanks [@TomTomB](https://github.com/TomTomB)! - Update to Angular v20

## 3.7.2

### Patch Changes

- [`91b6a3b`](https://github.com/ethlete-io/ethdk/commit/91b6a3ba51f6a60abe71b27d1eb88099e29b2418) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix class defines

## 3.7.1

### Patch Changes

- [`e34e60b`](https://github.com/ethlete-io/ethdk/commit/e34e60b26df11baf7d9c8dd305f91b60902294cc) Thanks [@TomTomB](https://github.com/TomTomB)! - Gracefully handle contentful assets where the file is missing (e.g. when no file is uploaded to the asset in Contentful for the current locale).

## 3.7.0

### Minor Changes

- [`1dd18fb`](https://github.com/ethlete-io/ethdk/commit/1dd18fb077b9b377384daac8eacae5732d7e7a3a) Thanks [@TomTomB](https://github.com/TomTomB)! - Update angular 19

## 3.6.4

### Patch Changes

- [`df7b967`](https://github.com/ethlete-io/ethdk/commit/df7b9670a1f53d5ea7f331ea4c47be253f36ddc0) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix contentful renderer breaking after auto removal of empty tags

- [`df7b967`](https://github.com/ethlete-io/ethdk/commit/df7b9670a1f53d5ea7f331ea4c47be253f36ddc0) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix contentful renderer not rendering br tags

- [`df7b967`](https://github.com/ethlete-io/ethdk/commit/df7b9670a1f53d5ea7f331ea4c47be253f36ddc0) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix contentful renderer not rendering self closing elements such as hr

## 3.6.3

### Patch Changes

- [`5ce9f36`](https://github.com/ethlete-io/ethdk/commit/5ce9f36a62797e734ad624346139c7a3884caa4f) Thanks [@TomTomB](https://github.com/TomTomB)! - Update to angular 18.1

## 3.6.2

### Patch Changes

- [`69ee325`](https://github.com/ethlete-io/ethdk/commit/69ee32561bf0df78569a1649053a37edf9741b9c) Thanks [@TomTomB](https://github.com/TomTomB)! - Bump only for updating peer deps

## 3.6.1

### Patch Changes

- [`ba2e546`](https://github.com/ethlete-io/ethdk/commit/ba2e54669666038da926808fcfdeacac93483eb3) Thanks [@TomTomB](https://github.com/TomTomB)! - Add missing exports for `ComponentLikeWithAsset` and `ComponentLikeWithContentfulRendererInputs` types.

## 3.6.0

### Minor Changes

- [`f744c9f`](https://github.com/ethlete-io/ethdk/commit/f744c9fb31f4807608834de8d2f6cd424208b177) Thanks [@TomTomB](https://github.com/TomTomB)! - Add `ContentfulGqlCollectionFilterVariables`, `ContentfulGqlOrder` and `ContentfulGqlWhereFilter` types

## 3.5.0

### Minor Changes

- [`0933d21`](https://github.com/ethlete-io/ethdk/commit/0933d21ac5dace9904f35b7f09d10403ee91f568) Thanks [@TomTomB](https://github.com/TomTomB)! - Add `isContentfulEntryType` type guard util

## 3.4.1

### Patch Changes

- [`bea3854`](https://github.com/ethlete-io/ethdk/commit/bea38548565087d05cbe23af9f67495835a7f100) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix contentful sys object typings for rest assets

## 3.4.0

### Minor Changes

- [`41a269c`](https://github.com/ethlete-io/ethdk/commit/41a269cd03c61d41f159116cf26b4c7be1312155) Thanks [@TomTomB](https://github.com/TomTomB)! - Add `createContentfulIncludeMap` util

## 3.3.0

### Minor Changes

- [`7c71af5`](https://github.com/ethlete-io/ethdk/commit/7c71af5fd7544395577a30b4ff541f26debc575f) Thanks [@TomTomB](https://github.com/TomTomB)! - Support the `ContentfulGqlImage` type inside the `ContentfulImageComponent`

- [`7c71af5`](https://github.com/ethlete-io/ethdk/commit/7c71af5fd7544395577a30b4ff541f26debc575f) Thanks [@TomTomB](https://github.com/TomTomB)! - Rename `ContentfulAsset` to `ContentfulRestAsset` to make it clear that it's a asset that is fetched from the REST API.

## 3.2.1

### Patch Changes

- [`6695e2b`](https://github.com/ethlete-io/ethdk/commit/6695e2b8f006d81b000cb93fbadaeed051760725) Thanks [@TomTomB](https://github.com/TomTomB)! - Add back missing contentful graph ql asset type

## 3.2.0

### Minor Changes

- [`4835e46`](https://github.com/ethlete-io/ethdk/commit/4835e46abcb0d2377d20a722e079641661cec2e3) Thanks [@TomTomB](https://github.com/TomTomB)! - Add `getEntries` and `getAssets` methods to the `ContentfulIncludeMap`

## 3.1.0

### Minor Changes

- [`9dae37f`](https://github.com/ethlete-io/ethdk/commit/9dae37f2ead003cbce892f636ba35ceb503afe16) Thanks [@TomTomB](https://github.com/TomTomB)! - Change the type of `ContentfulIncludeMap` to be more ergonomic. Instead of returning raw maps for assets and entries, it now returns a generic `getEntry` function as well as a `getAsset` function. This makes it easier to work with the included assets and entries.

  ```ts
  // The type of the fields property inside a contentful entry. Could be just about anything.
  interface MyImageCollectionFields {
    title: string;
    images: ContentfulAsset[];
  }

  // Inside a component class that gets rendered by the rich-text renderer
  includes = input.required<ContentfulIncludeMap>();

  // "my-content-type" is the type defined by contentful inside entry.sys.id
  // This is needed to make sure the entry is of the correct type since the user could put any entry here.
  myImageCollection = computed(() =>
    this.includes().getEntry<MyImageCollectionFields>('someId', 'my-image-collection'),
  );
  ```

## 3.0.1

### Patch Changes

- [`de8fe79`](https://github.com/ethlete-io/ethdk/commit/de8fe79e35010fd9eac502a8f3187dab3a5d83d7) Thanks [@TomTomB](https://github.com/TomTomB)! - Add missing input transforms for booleans and numbers

## 3.0.0

### Major Changes

- [`ef63100`](https://github.com/ethlete-io/ethdk/commit/ef6310039b70c0321021a532b5818822518f47c6) Thanks [@TomTomB](https://github.com/TomTomB)! - The `rich-text-renderer` component was rebuild from scratch.

  - The `richText` input was renamed to `content` and is required.
  - The value of the `content` input should be a `ContentfulCollection` object. This can be directly fetched using the Contentful REST API. Do not use their GraphQL API for this purpose.
  - A `richTextPath` input was added to allow for the customization of the path to the `richText` field in the `ContentfulCollection` object. It is required and should point to the start of the rich text object inside the `ContentfulCollection` object. The start contains a `nodeType` property with the value `document`.
  - All custom components now can contain the following input signals. They are optional and will be used by the renderer to expose the entry's data.
    - `fields` with your custom type defined inside Contentful.
    - `includes` with a type of `ContentfulIncludeMap`. Using this map you can access linked entries and assets.
    - `metadata` with a type of `ContentfulMetadata`
    - `sys` with a type of `ContentfulSys`
  - Inside the `ContentfulAudioComponent`, `ContentfulFileComponent`, `ContentfulImageComponent`, and `ContentfulVideoComponent` components, the `data` input was renamed to `asset`.
  - If you supply custom components for the ones mentioned above, they must also contain an `asset` signal with a type of `ContentfulAsset`.
  - Everything evolving around the `RICH_TEXT_RENDERER_COMPONENT_DATA` DI token was removed. The renderer now sets and updates inputs instead of using dependency injection.
  - The `GQL_FRAGMENT_CONTENTFUL_IMAGE` constant has been removed without replacement.

## 2.1.2

### Patch Changes

- [#1614](https://github.com/ethlete-io/ethdk/pull/1614) [`5f414b9`](https://github.com/ethlete-io/ethdk/commit/5f414b96362366f650945835b87d3cf8ce292bc1) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix various circular dependencies

## 2.1.1

### Patch Changes

- [`2a75a9d8`](https://github.com/ethlete-io/ethdk/commit/2a75a9d856b6f5190570ac2bebcc02afdd409745) Thanks [@TomTomB](https://github.com/TomTomB)! - Migrate to new control flow

## 2.1.0

### Minor Changes

- [`8a714a01`](https://github.com/ethlete-io/ethdk/commit/8a714a0147a58fa84c9258fd4b14ffdc835b3442) Thanks [@TomTomB](https://github.com/TomTomB)! - Update to Angular 17

## 2.0.3

### Patch Changes

- Updated dependencies []:
  - @ethlete/cdk@4.0.3
  - @ethlete/core@4.0.3
  - @ethlete/query@5.0.3

## 2.0.2

### Patch Changes

- Updated dependencies []:
  - @ethlete/cdk@4.0.2
  - @ethlete/core@4.0.2
  - @ethlete/query@5.0.2

## 2.0.1

### Patch Changes

- Updated dependencies [[`3f77e8d5`](https://github.com/ethlete-io/ethdk/commit/3f77e8d52a5ba45c4f3da4e34dcc08e0561ae04d)]:
  - @ethlete/core@4.0.1
  - @ethlete/cdk@4.0.1
  - @ethlete/query@5.0.1

## 2.0.0

### Patch Changes

- Updated dependencies [[`2ded18ef`](https://github.com/ethlete-io/ethdk/commit/2ded18ef14115c9c9e2fb4f86c688d436c807766)]:
  - @ethlete/cdk@4.0.0
  - @ethlete/core@4.0.0
  - @ethlete/query@5.0.0

## 1.0.3

### Patch Changes

- [`0328fb76`](https://github.com/ethlete-io/ethdk/commit/0328fb769ca53042835826c1967b8d2f25072d63) Thanks [@TomTomB](https://github.com/TomTomB)! - Dependency sync only

- Updated dependencies [[`0328fb76`](https://github.com/ethlete-io/ethdk/commit/0328fb769ca53042835826c1967b8d2f25072d63)]:
  - @ethlete/cdk@3.22.7
  - @ethlete/core@3.13.2
  - @ethlete/query@4.20.5

## 1.0.2

### Patch Changes

- [`04e0db6`](https://github.com/ethlete-io/ethdk/commit/04e0db6c0007d58705f88605f3f8ed2d0ad05ce3) Thanks [@TomTomB](https://github.com/TomTomB)! - Update to Angular 16

## 1.0.1

### Patch Changes

- [`3fe7e30`](https://github.com/ethlete-io/ethdk/commit/3fe7e30756f24543c96ac62aec86a0efba7fddac) Thanks [@TomTomB](https://github.com/TomTomB)! - Update deps to use cdk instead of components

## 1.0.0

### Major Changes

- [#475](https://github.com/ethlete-io/ethdk/pull/475) [`44ac6e6`](https://github.com/ethlete-io/ethdk/commit/44ac6e621c9b2c2e02b45f7abc2c1b3111604d56) Thanks [@TomTomB](https://github.com/TomTomB)! - Initial stable release

### Minor Changes

- [#63](https://github.com/ethlete-io/ethdk/pull/63) [`8b05caa`](https://github.com/ethlete-io/ethdk/commit/8b05caa7234aa2ea22efe59c6c955b6981d50f18) Thanks [@TomTomB](https://github.com/TomTomB)! - Add contentful rich text renderer

- [#475](https://github.com/ethlete-io/ethdk/pull/475) [`24b5fd2`](https://github.com/ethlete-io/ethdk/commit/24b5fd2bc443cb31752c01d7afaaa7c881714e41) Thanks [@TomTomB](https://github.com/TomTomB)! - Add contentful image and asset fragments

- [#475](https://github.com/ethlete-io/ethdk/pull/475) [`4cfa96d`](https://github.com/ethlete-io/ethdk/commit/4cfa96d6b13c8ea51c9428b6fe0badf692f776d6) Thanks [@TomTomB](https://github.com/TomTomB)! - Update contentful image to use the new picture component

- [#475](https://github.com/ethlete-io/ethdk/pull/475) [`36e6462`](https://github.com/ethlete-io/ethdk/commit/36e6462b46ff8241e666f5e4355b28a4f40fa4b5) Thanks [@TomTomB](https://github.com/TomTomB)! - Make image sizes only defineable via code

- [#418](https://github.com/ethlete-io/ethdk/pull/418) [`07e8687`](https://github.com/ethlete-io/ethdk/commit/07e8687f3771b6286ab6bb621fe05816fc09066f) Thanks [@nziermann](https://github.com/nziermann)! - Switch from modules to pure array exports

### Patch Changes

- [#278](https://github.com/ethlete-io/ethdk/pull/278) [`d3555ab`](https://github.com/ethlete-io/ethdk/commit/d3555abdb5279967b95b34a9ce1e4c0401fde0f2) Thanks [@manuelschulte](https://github.com/manuelschulte)! - Clear childNodes to prevent appending to existing ones

- [#475](https://github.com/ethlete-io/ethdk/pull/475) [`ba8071c`](https://github.com/ethlete-io/ethdk/commit/ba8071caa08636193bebc0fdcb986205b41b7023) Thanks [@TomTomB](https://github.com/TomTomB)! - Do not use injected rich text data if custom data is provided

- [#183](https://github.com/ethlete-io/ethdk/pull/183) [`1521117`](https://github.com/ethlete-io/ethdk/commit/152111770cd33dec9aa81288e8a596f86e32b154) Thanks [@baltruschat](https://github.com/baltruschat)! - Add source types to contentful image component

- [#475](https://github.com/ethlete-io/ethdk/pull/475) [`516b56b`](https://github.com/ethlete-io/ethdk/commit/516b56bf8d913a17370ea07e71facc534adb73bc) Thanks [@TomTomB](https://github.com/TomTomB)! - Remove no longer existing properties from contentful image gql fragment

- [#65](https://github.com/ethlete-io/ethdk/pull/65) [`1cf9a35`](https://github.com/ethlete-io/ethdk/commit/1cf9a35a39885c1054721db20ce23424c81bad74) Thanks [@TomTomB](https://github.com/TomTomB)! - Add missing exports

- [#475](https://github.com/ethlete-io/ethdk/pull/475) [`4491262`](https://github.com/ethlete-io/ethdk/commit/4491262c1d1575f20dacf5abd34e382fd8eb32b3) Thanks [@TomTomB](https://github.com/TomTomB)! - Use ngSrc directive for contentful image

- [#475](https://github.com/ethlete-io/ethdk/pull/475) [`4d5247f`](https://github.com/ethlete-io/ethdk/commit/4d5247ffaa6f1dab2370328c5a84ffcf88664445) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix rich text renderer data injector using the wrong data

- [#475](https://github.com/ethlete-io/ethdk/pull/475) [`516b56b`](https://github.com/ethlete-io/ethdk/commit/516b56bf8d913a17370ea07e71facc534adb73bc) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix contentful image api jpeg source type naming

- [#475](https://github.com/ethlete-io/ethdk/pull/475) [`1327af1`](https://github.com/ethlete-io/ethdk/commit/1327af13c721f8fe26d53bd12abd17e93d62bee5) Thanks [@TomTomB](https://github.com/TomTomB)! - Dependency updates

- [#475](https://github.com/ethlete-io/ethdk/pull/475) [`d92c892`](https://github.com/ethlete-io/ethdk/commit/d92c892b567903cb6118a1c72f1251a362af5b15) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix rich text rendering of embedded entries

- [#475](https://github.com/ethlete-io/ethdk/pull/475) [`08dedb4`](https://github.com/ethlete-io/ethdk/commit/08dedb4644d0a77f975bd01f500d51d345b39a18) Thanks [@TomTomB](https://github.com/TomTomB)! - Switch from config classes to objects

- [#475](https://github.com/ethlete-io/ethdk/pull/475) [`b7e087c`](https://github.com/ethlete-io/ethdk/commit/b7e087c096aea289fdc81806839ea7dede72e5db) Thanks [@TomTomB](https://github.com/TomTomB)! - Add inputs to configure classes inside contentful components

## 0.1.0-next.14

### Minor Changes

- [#309](https://github.com/ethlete-io/ethdk/pull/309) [`07e8687`](https://github.com/ethlete-io/ethdk/commit/07e8687f3771b6286ab6bb621fe05816fc09066f) Thanks [@renovate](https://github.com/apps/renovate)! - Switch from modules to pure array exports

## 0.1.0-next.13

### Patch Changes

- [`1327af1`](https://github.com/ethlete-io/ethdk/commit/1327af13c721f8fe26d53bd12abd17e93d62bee5) Thanks [@TomTomB](https://github.com/TomTomB)! - Dependency updates

## 0.1.0-next.12

### Patch Changes

- [`516b56b`](https://github.com/ethlete-io/ethdk/commit/516b56bf8d913a17370ea07e71facc534adb73bc) Thanks [@TomTomB](https://github.com/TomTomB)! - Remove no longer existing properties from contentful image gql fragment

- [`516b56b`](https://github.com/ethlete-io/ethdk/commit/516b56bf8d913a17370ea07e71facc534adb73bc) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix contentful image api jpeg source type naming

## 0.1.0-next.11

### Minor Changes

- [`36e6462`](https://github.com/ethlete-io/ethdk/commit/36e6462b46ff8241e666f5e4355b28a4f40fa4b5) - Make image sizes only defineable via code

## 0.1.0-next.10

### Minor Changes

- [`4cfa96d`](https://github.com/ethlete-io/ethdk/commit/4cfa96d6b13c8ea51c9428b6fe0badf692f776d6) Thanks [@TomTomB](https://github.com/TomTomB)! - Update contentful image to use the new picture component

## 0.1.0-next.9

### Minor Changes

- [`24b5fd2`](https://github.com/ethlete-io/ethdk/commit/24b5fd2bc443cb31752c01d7afaaa7c881714e41) Thanks [@TomTomB](https://github.com/TomTomB)! - Add contentful image and asset fragments

## 0.1.0-next.8

### Patch Changes

- [#278](https://github.com/ethlete-io/ethdk/pull/278) [`d3555ab`](https://github.com/ethlete-io/ethdk/commit/d3555abdb5279967b95b34a9ce1e4c0401fde0f2) Thanks [@manuelschulte](https://github.com/manuelschulte)! - Clear childNodes to prevent appending to existing ones

## 0.1.0-next.7

### Patch Changes

- [#193](https://github.com/ethlete-io/ethdk/pull/193) [`4491262`](https://github.com/ethlete-io/ethdk/commit/4491262c1d1575f20dacf5abd34e382fd8eb32b3) Thanks [@renovate](https://github.com/apps/renovate)! - Use ngSrc directive for contentful image

- [#193](https://github.com/ethlete-io/ethdk/pull/193) [`08dedb4`](https://github.com/ethlete-io/ethdk/commit/08dedb4644d0a77f975bd01f500d51d345b39a18) Thanks [@renovate](https://github.com/apps/renovate)! - Switch from config classes to objects

## 0.1.0-next.6

### Patch Changes

- [#183](https://github.com/ethlete-io/ethdk/pull/183) [`1521117`](https://github.com/ethlete-io/ethdk/commit/152111770cd33dec9aa81288e8a596f86e32b154) Thanks [@baltruschat](https://github.com/baltruschat)! - Add source types to contentful image component

## 0.1.0-next.5

### Patch Changes

- [`ba8071c`](https://github.com/ethlete-io/ethdk/commit/ba8071caa08636193bebc0fdcb986205b41b7023) Thanks [@TomTomB](https://github.com/TomTomB)! - Do not use injected rich text data if custom data is provided

## 0.1.0-next.4

### Patch Changes

- [`4d5247f`](https://github.com/ethlete-io/ethdk/commit/4d5247ffaa6f1dab2370328c5a84ffcf88664445) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix rich text renderer data injector using the wrong data

## 0.1.0-next.3

### Patch Changes

- [`d92c892`](https://github.com/ethlete-io/ethdk/commit/d92c892b567903cb6118a1c72f1251a362af5b15) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix rich text rendering of embedded entries

## 0.1.0-next.2

### Patch Changes

- [`b7e087c`](https://github.com/ethlete-io/ethdk/commit/b7e087c096aea289fdc81806839ea7dede72e5db) Thanks [@TomTomB](https://github.com/TomTomB)! - Add inputs to configure classes inside contentful components

## 0.1.0-next.1

### Patch Changes

- [#65](https://github.com/ethlete-io/ethdk/pull/65) [`1cf9a35`](https://github.com/ethlete-io/ethdk/commit/1cf9a35a39885c1054721db20ce23424c81bad74) Thanks [@TomTomB](https://github.com/TomTomB)! - Add missing exports

## 0.1.0-next.0

### Minor Changes

- [#63](https://github.com/ethlete-io/ethdk/pull/63) [`8b05caa`](https://github.com/ethlete-io/ethdk/commit/8b05caa7234aa2ea22efe59c6c955b6981d50f18) Thanks [@TomTomB](https://github.com/TomTomB)! - Add contentful rich text renderer
