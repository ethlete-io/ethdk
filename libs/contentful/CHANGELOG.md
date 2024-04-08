# @ethlete/contentful

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
