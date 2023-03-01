# @ethlete/query

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
