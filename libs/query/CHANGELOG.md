# @ethlete/query

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
