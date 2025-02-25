# @ethlete/query

## 5.31.1

### Patch Changes

- [`79c10d7`](https://github.com/ethlete-io/ethdk/commit/79c10d71787dc46da4ede3a6dd13b0e49ab9433c) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix transport options not getting applied

## 5.31.0

### Minor Changes

- [`b71046d`](https://github.com/ethlete-io/ethdk/commit/b71046d9ef847ea577883e16c0f6c9c7087d2e2c) Thanks [@TomTomB](https://github.com/TomTomB)! - Expose transports option in ws

## 5.30.2

### Patch Changes

- [`7726bcd`](https://github.com/ethlete-io/ethdk/commit/7726bcd4ed5719718a3b6bb3d56cba05522be91b) Thanks [@TomTomB](https://github.com/TomTomB)! - Secure query race condition

## 5.30.1

### Patch Changes

- [`ca5f51a`](https://github.com/ethlete-io/ethdk/commit/ca5f51a8a04583126bbc946d110137f28f9f2b36) Thanks [@TomTomB](https://github.com/TomTomB)! - Only set error list is list to true if there is more than 1 error inside

## 5.30.0

### Minor Changes

- [`c48032f`](https://github.com/ethlete-io/ethdk/commit/c48032f5d7b29708fa6668835a8cc85f97ebdb29) Thanks [@TomTomB](https://github.com/TomTomB)! - Add isCookiePresent to query 3 auth provider

### Patch Changes

- [`5713174`](https://github.com/ethlete-io/ethdk/commit/5713174285fa2846d2b908a7627741170802e45a) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix get queries inside bearer auth provider getting executed automatically

- [`7180e12`](https://github.com/ethlete-io/ethdk/commit/7180e12cb823910bb7d0fd7db2808402553f1402) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix isSymfonyListError check

## 5.29.1

### Patch Changes

- [`e30dff4`](https://github.com/ethlete-io/ethdk/commit/e30dff42ce2d5c5f2a976888b8aad112814c710e) Thanks [@TomTomB](https://github.com/TomTomB)! - Add missing export for query error response

## 5.29.0

### Minor Changes

- [`089ce09`](https://github.com/ethlete-io/ethdk/commit/089ce09cb72b4420a49d6f165776fe3f391dc2fe) Thanks [@TomTomB](https://github.com/TomTomB)! - Add query error response parsing to query 3

- [`089ce09`](https://github.com/ethlete-io/ethdk/commit/089ce09cb72b4420a49d6f165776fe3f391dc2fe) Thanks [@TomTomB](https://github.com/TomTomB)! - Add pipes for parsing http status codes

## 5.28.1

### Patch Changes

- [`89cf913`](https://github.com/ethlete-io/ethdk/commit/89cf913eafd1ec1215ad857f92b22d6a5b95092b) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix access of undefined error in query 3

## 5.28.0

### Minor Changes

- [`ef602b4`](https://github.com/ethlete-io/ethdk/commit/ef602b4265ab4d01c581772687172eb591abfa3e) Thanks [@TomTomB](https://github.com/TomTomB)! - Add `asReadonly` method to query object

## 5.27.1

### Patch Changes

- [`a479d75`](https://github.com/ethlete-io/ethdk/commit/a479d759c57fdbbae1c4cb96893aa6780049153d) Thanks [@TomTomB](https://github.com/TomTomB)! - Make paged query args nullable

## 5.27.0

### Minor Changes

- [`64d10f2`](https://github.com/ethlete-io/ethdk/commit/64d10f2633675302a09192adfc96c4158628013c) Thanks [@TomTomB](https://github.com/TomTomB)! - Add all responses param to paged query functions

## 5.26.0

### Minor Changes

- [`ee8928e`](https://github.com/ethlete-io/ethdk/commit/ee8928ecf262690698de4a19211d6a601f66fa27) Thanks [@TomTomB](https://github.com/TomTomB)! - Make route and query primary params instead of object properties

## 5.25.1

### Patch Changes

- [`587fc9d`](https://github.com/ethlete-io/ethdk/commit/587fc9dc0cbc04de9d07878305d0eea832ddfb29) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix inferred typings in paged query stack

## 5.25.0

### Minor Changes

- [`c2bd4e3`](https://github.com/ethlete-io/ethdk/commit/c2bd4e3e3b9189a8d0181708700a37a14b755f41) Thanks [@TomTomB](https://github.com/TomTomB)! - Integrate web socket support into queries

- [`a918307`](https://github.com/ethlete-io/ethdk/commit/a91830763a32bc5bd0393853696af8be029a0111) Thanks [@TomTomB](https://github.com/TomTomB)! - Add `autoLoginExcludeRoutes` option to experimental bearer auth provider cookie configuration

### Patch Changes

- [`91b6a3b`](https://github.com/ethlete-io/ethdk/commit/91b6a3ba51f6a60abe71b27d1eb88099e29b2418) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix class defines

## 5.24.0

### Minor Changes

- [`40fd002`](https://github.com/ethlete-io/ethdk/commit/40fd0023407ff7c9aa652a74317861ffd0d1abbf) Thanks [@TomTomB](https://github.com/TomTomB)! - Add experimental web socket support using socket io. These functions are exported under the `E.` import.

## 5.23.0

### Minor Changes

- [`64e4c54`](https://github.com/ethlete-io/ethdk/commit/64e4c54bf46a038be71e070d1e8d52601b4b2909) Thanks [@TomTomB](https://github.com/TomTomB)! - Add reset method to queryStateResponseSignal to reset its value if cacheResponse is true

### Patch Changes

- [`2d9463b`](https://github.com/ethlete-io/ethdk/commit/2d9463b4ac2d2cbdc58a9badb72786913693b358) Thanks [@TomTomB](https://github.com/TomTomB)! - use allowCache instead of skipCache and default to skipping the cache in exp query

## 5.22.0

### Minor Changes

- [`1dd18fb`](https://github.com/ethlete-io/ethdk/commit/1dd18fb077b9b377384daac8eacae5732d7e7a3a) Thanks [@TomTomB](https://github.com/TomTomB)! - Update angular 19

## 5.21.1

### Patch Changes

- [`291a756`](https://github.com/ethlete-io/ethdk/commit/291a75639034f12829d6577eee0616bb34e998f6) Thanks [@TomTomB](https://github.com/TomTomB)! - Query stack exp

## 5.21.0

### Minor Changes

- [`3c4e7ee`](https://github.com/ethlete-io/ethdk/commit/3c4e7ee3a9d66ebd031913f1be7860d25f12b5ca) Thanks [@TomTomB](https://github.com/TomTomB)! - Allow query form default value to be a function

## 5.20.1

### Patch Changes

- [`0f53f8f`](https://github.com/ethlete-io/ethdk/commit/0f53f8f73b50ee4a22c9ff64ff39557c3f5b313c) Thanks [@TomTomB](https://github.com/TomTomB)! - Cache query response if the new query gets cancelled

## 5.20.0

### Minor Changes

- [`cf2150f`](https://github.com/ethlete-io/ethdk/commit/cf2150f59a20ae65c41bbabafa446a5d7c1ceaea) Thanks [@TomTomB](https://github.com/TomTomB)! - Add `skipAutoTransform` option to query fields. This should be set to true on e.g. search fields. Otherwise, the search value might get transformed from a string to a number, which leads to loss of user input. E.g. "0031" would become "31" and "30.00" would become "30". Also whitespace would no longer work. The query form can detect these cases on its own but it's better to prevent them from happening in the first place.

## 5.19.0

### Minor Changes

- [`c28c233`](https://github.com/ethlete-io/ethdk/commit/c28c233d04b2e3e0772d56fb0c8490d26084a239) Thanks [@TomTomB](https://github.com/TomTomB)! - Add `QueryCollectionWithNullableQuery` utility type

## 5.18.0

### Minor Changes

- [`211bd8d`](https://github.com/ethlete-io/ethdk/commit/211bd8db1ea19f222743155b9185e2910c9662ac) Thanks [@TomTomB](https://github.com/TomTomB)! - Expose the reworked query api via `ExperimentalQuery` import. The new api makes rxjs optional.

## 5.17.0

### Minor Changes

- [`3c4cafe`](https://github.com/ethlete-io/ethdk/commit/3c4cafeaabd66378b5f8a7df0a4297609da43022) Thanks [@TomTomB](https://github.com/TomTomB)! - Add response headers to success query states

### Patch Changes

- [`3c4cafe`](https://github.com/ethlete-io/ethdk/commit/3c4cafeaabd66378b5f8a7df0a4297609da43022) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix a race condition causing the angular router to cancel navigations resulting in invalid state

## 5.16.2

### Patch Changes

- [`5ce9f36`](https://github.com/ethlete-io/ethdk/commit/5ce9f36a62797e734ad624346139c7a3884caa4f) Thanks [@TomTomB](https://github.com/TomTomB)! - Update to angular 18.1

## 5.16.1

### Patch Changes

- [`04b10fd`](https://github.com/ethlete-io/ethdk/commit/04b10fdd2dae55b32b863cf9f576b5818478811a) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix source code getting pushed to npm instead of compiled dist code

## 5.16.0

### Minor Changes

- [`3c0cb69`](https://github.com/ethlete-io/ethdk/commit/3c0cb69d3942c1e562905b940b2d75fcb81e77f9) Thanks [@TomTomB](https://github.com/TomTomB)! - Add option to `QueryForm` `resetAllFieldsToDefault` method to skip specific fields by their key

- [`3c0cb69`](https://github.com/ethlete-io/ethdk/commit/3c0cb69d3942c1e562905b940b2d75fcb81e77f9) Thanks [@TomTomB](https://github.com/TomTomB)! - Add `appendDefaultValueToUrl` option to `QueryField`

## 5.15.1

### Patch Changes

- [`69ee325`](https://github.com/ethlete-io/ethdk/commit/69ee32561bf0df78569a1649053a37edf9741b9c) Thanks [@TomTomB](https://github.com/TomTomB)! - Bump only for updating peer deps

## 5.15.0

### Minor Changes

- [`42a4415`](https://github.com/ethlete-io/ethdk/commit/42a44152807316c57a739ae9ccc6e607ec934141) Thanks [@TomTomB](https://github.com/TomTomB)! - Add `resetAllFieldsToDefault` method to `QueryForm`.

## 5.14.1

### Patch Changes

- [`88730d5`](https://github.com/ethlete-io/ethdk/commit/88730d5b4110c4fd29185caad403feabf7695bf5) Thanks [@TomTomB](https://github.com/TomTomB)! - Auto transform strings of numbers and booleans to their correct type inside query forms

## 5.14.0

### Minor Changes

- [`4e28738`](https://github.com/ethlete-io/ethdk/commit/4e287388a02fabe8073f1af3ee26803880739658) Thanks [@TomTomB](https://github.com/TomTomB)! - Add `resetFieldToDefault` and `resetFieldsToDefault` methods to query form

- [`4e28738`](https://github.com/ethlete-io/ethdk/commit/4e287388a02fabe8073f1af3ee26803880739658) Thanks [@TomTomB](https://github.com/TomTomB)! - Add option to specify a default value for query fields

- [`fc8dd2a`](https://github.com/ethlete-io/ethdk/commit/fc8dd2af5792733446dcf720add6b8a9c6047f7c) Thanks [@TomTomB](https://github.com/TomTomB)! - Add AnyQueryForm type

## 5.13.2

### Patch Changes

- [`63f8f20`](https://github.com/ethlete-io/ethdk/commit/63f8f2062da109b263996b24eb0e64daeb869cca) Thanks [@TomTomB](https://github.com/TomTomB)! - Only bind click listener to infinity query trigger if the element is of type button

## 5.13.1

### Patch Changes

- [`2fe84fa`](https://github.com/ethlete-io/ethdk/commit/2fe84fa12b02248d0a7838ac89d07b172a4c977f) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix an issue inside the infinity query where using skip-based pagination could result in a runtime error.

## 5.13.0

### Minor Changes

- [`56dd26e`](https://github.com/ethlete-io/ethdk/commit/56dd26ec34310da6d344c4851a7e34518c88b678) Thanks [@TomTomB](https://github.com/TomTomB)! - Allow null to be passed into `InfinityQueryOf` type

## 5.12.2

### Patch Changes

- [`2c27678`](https://github.com/ethlete-io/ethdk/commit/2c27678f9e48f241df37073d43f736c9d08f3511) Thanks [@TomTomB](https://github.com/TomTomB)! - Minir query devtools styling fixes

## 5.12.1

### Patch Changes

- [`7adf0de`](https://github.com/ethlete-io/ethdk/commit/7adf0de1c1c13dfbeef6ab43e5666197ac305242) Thanks [@TomTomB](https://github.com/TomTomB)! - Kepp loading state on false inside infinity query if the query was triggered by polling

- [`7adf0de`](https://github.com/ethlete-io/ethdk/commit/7adf0de1c1c13dfbeef6ab43e5666197ac305242) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix flickering inside infinity query due to polling

## 5.12.0

### Minor Changes

- [`aeb1134`](https://github.com/ethlete-io/ethdk/commit/aeb1134f80f0bcf53e11131d64b8b2d8c1434295) Thanks [@TomTomB](https://github.com/TomTomB)! - Add queryComputedTillTruthy util

## 5.11.0

### Minor Changes

- [`6899b23`](https://github.com/ethlete-io/ethdk/commit/6899b23c6bcf0cf17248cdb891ee8cd4725de684) Thanks [@TomTomB](https://github.com/TomTomB)! - Add `pollingInterval` option to infinity query config

- [`6899b23`](https://github.com/ethlete-io/ethdk/commit/6899b23c6bcf0cf17248cdb891ee8cd4725de684) Thanks [@TomTomB](https://github.com/TomTomB)! - Expose the infinity query data array as signal

## 5.10.0

### Minor Changes

- [`3de03d0`](https://github.com/ethlete-io/ethdk/commit/3de03d05292ef222ce66e2bec0af7616612a8a1d) Thanks [@TomTomB](https://github.com/TomTomB)! - Allow QueryForm `queryParamPrefix` to be of type `function` to allow passing signal input values into it

## 5.9.1

### Patch Changes

- [`500e4c8`](https://github.com/ethlete-io/ethdk/commit/500e4c8ee5bde56713837d07515c10c4ea034ff4) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix infinity query not triggering initially in certain cases

## 5.9.0

### Minor Changes

- [`aadd492`](https://github.com/ethlete-io/ethdk/commit/aadd492ccfc524bd3bbee14c6fa9773099f52aac) Thanks [@TomTomB](https://github.com/TomTomB)! - Add auth provider section to query devtools

- [`477f8e3`](https://github.com/ethlete-io/ethdk/commit/477f8e3dbadda2063fd89e12d9cb0f629c09b852) Thanks [@TomTomB](https://github.com/TomTomB)! - Wait for the jwt auth provider to be ready before executing queries with `secure` flag set to `true`.

## 5.8.1

### Patch Changes

- [#1614](https://github.com/ethlete-io/ethdk/pull/1614) [`5f414b9`](https://github.com/ethlete-io/ethdk/commit/5f414b96362366f650945835b87d3cf8ce292bc1) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix various circular dependencies

## 5.8.0

### Minor Changes

- [`d1c07b5`](https://github.com/ethlete-io/ethdk/commit/d1c07b556bd41a48b4571165a38fa302a92c29a0) Thanks [@TomTomB](https://github.com/TomTomB)! - Add `mock` property to `prepare` method to allow for mocking responses and errors.
  Mocked queries will ignore the `secure` property and will not be sent over the network.

  ```ts
  // The query results in a successful response after 300ms using the mock response
  getBooks
    .prepare({
      queryParams: { page: 1 },
      mock: { response: MOCK_RESPONSE, delay: 300 },
    })
    .execute();

  // The query results in a failed response after 300ms using the mock error
  getBooks
    .prepare({
      queryParams: { page: 1 },
      mock: { error: MOCK_ERROR, delay: 300 },
    })
    .execute();

  // The query results in a successful response using the mock response after being retried 3 times
  getBooks
    .prepare({
      queryParams: { page: 1 },
      mock: { retryIntoResponse: true },
    })
    .execute();

  // The query results in a successful response after 6 progress events using the mock response
  uploadSomeFile
    .prepare({
      queryParams: { page: 1 },
      mock: {
        response: MOCK_RESPONSE,
        progress: {
          eventCount: 6,
        },
      },
    })
    .execute();
  ```

## 5.7.0

### Minor Changes

- [#1603](https://github.com/ethlete-io/ethdk/pull/1603) [`368e4a5`](https://github.com/ethlete-io/ethdk/commit/368e4a5110476a287c27e09ab65c8953d9991c7e) Thanks [@TomTomB](https://github.com/TomTomB)! - Add util to detect a symfony form list error

## 5.6.2

### Patch Changes

- [`02e8dc5`](https://github.com/ethlete-io/ethdk/commit/02e8dc533004e626066eeee5fa4ff23474bae358) Thanks [@TomTomB](https://github.com/TomTomB)! - Allow usage of nested interfaces inside query params object

## 5.6.1

### Patch Changes

- [#1571](https://github.com/ethlete-io/ethdk/pull/1571) [`6f4f845`](https://github.com/ethlete-io/ethdk/commit/6f4f845705689b2dc3e88fcc793180ee24d42851) Thanks [@Gw3i](https://github.com/Gw3i)! - Emmit change events for query form controls that are getting reset

## 5.6.0

### Minor Changes

- [`3725433`](https://github.com/ethlete-io/ethdk/commit/372543339c8d04e8ed0b53237467fc509a0327b4) Thanks [@TomTomB](https://github.com/TomTomB)! - Add `QueryFormOf` type to create a query form type using a `FormGroup`.

### Patch Changes

- [`7f932c9`](https://github.com/ethlete-io/ethdk/commit/7f932c95850d3e0936e554109189aafaa990f1ea) Thanks [@TomTomB](https://github.com/TomTomB)! - Patch the internal `FormGroup` methods `patchValue` and `setValue` with the ones from `QueryForm` to make whole form patching/setting less error-prone.

- [`7f932c9`](https://github.com/ethlete-io/ethdk/commit/7f932c95850d3e0936e554109189aafaa990f1ea) Thanks [@TomTomB](https://github.com/TomTomB)! - Return the current query form instance from `QueryForm.observe` method. This allows for the form to be initialized and enabled without the need for a constructor.

  ```ts
  class MyComponent {
    form = new QueryForm({
      name: new QueryField({ control: new FormControl('John') }),
    }).observe();
  }
  ```

## 5.5.0

### Minor Changes

- [`8d78b59`](https://github.com/ethlete-io/ethdk/commit/8d78b59151ad9fc073dec0eab9e10eba63b8dceb) Thanks [@TomTomB](https://github.com/TomTomB)! - Add option to support multiple query forms at the same time

## 5.4.1

### Patch Changes

- [`202a54f`](https://github.com/ethlete-io/ethdk/commit/202a54f209636fa5d89a0289f22aedefa16fef5c) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix query container handling skipping the provided initial value

## 5.4.0

### Minor Changes

- [`3c96588`](https://github.com/ethlete-io/ethdk/commit/3c96588f6b481e076fb66f36de578a52da99032f) Thanks [@TomTomB](https://github.com/TomTomB)! - Add queryArrayComputed util

## 5.3.0

### Minor Changes

- [`537ffb2`](https://github.com/ethlete-io/ethdk/commit/537ffb2f480fba99915a0ac06b64f303bbfb2d08) Thanks [@TomTomB](https://github.com/TomTomB)! - Add onSuccess and onFailure helpers to query class

## 5.2.0

### Minor Changes

- [`110a601`](https://github.com/ethlete-io/ethdk/commit/110a601356dcea887c99800a4b34670490ec09db) Thanks [@TomTomB](https://github.com/TomTomB)! - Add option to set same site option for the cookie in bearer auth provider

## 5.1.2

### Patch Changes

- [`4339cd1`](https://github.com/ethlete-io/ethdk/commit/4339cd18bbb16acfdc96ec909777506923ad0cad) Thanks [@TomTomB](https://github.com/TomTomB)! - Don't complete query state subscription via takeUntilResponse if the query state is prepared

## 5.1.1

### Patch Changes

- [`2a75a9d8`](https://github.com/ethlete-io/ethdk/commit/2a75a9d856b6f5190570ac2bebcc02afdd409745) Thanks [@TomTomB](https://github.com/TomTomB)! - Migrate to new control flow

## 5.1.0

### Minor Changes

- [`8a714a01`](https://github.com/ethlete-io/ethdk/commit/8a714a0147a58fa84c9258fd4b14ffdc835b3442) Thanks [@TomTomB](https://github.com/TomTomB)! - Update to Angular 17

## 5.0.5

### Patch Changes

- [`14a60556`](https://github.com/ethlete-io/ethdk/commit/14a60556265c5e5541a60a5f8f70329c54df3e9a) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix createInfinityQueryConfig typings

## 5.0.4

### Patch Changes

- [`b84012f3`](https://github.com/ethlete-io/ethdk/commit/b84012f3d48d6ea1ff8f9181e4b6c834741851ec) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix infinity query typings when the provider query creator uses an entity store

## 5.0.3

### Patch Changes

- Updated dependencies [[`ce7e1055`](https://github.com/ethlete-io/ethdk/commit/ce7e1055cc24018d8e0ac3550a7ceb8ad96253f0)]:
  - @ethlete/types@1.6.2
  - @ethlete/core@4.0.3

## 5.0.2

### Patch Changes

- Updated dependencies [[`3216a9aa`](https://github.com/ethlete-io/ethdk/commit/3216a9aaa6baa0c846d1702562b3959bec5fbac7)]:
  - @ethlete/types@1.6.1
  - @ethlete/core@4.0.2

## 5.0.1

### Patch Changes

- Updated dependencies [[`3f77e8d5`](https://github.com/ethlete-io/ethdk/commit/3f77e8d52a5ba45c4f3da4e34dcc08e0561ae04d)]:
  - @ethlete/core@4.0.1

## 5.0.0

### Patch Changes

- Updated dependencies [[`82f62921`](https://github.com/ethlete-io/ethdk/commit/82f629215c085a4f6d78f36a8981e34f4e626bbd)]:
  - @ethlete/types@1.6.0
  - @ethlete/core@4.0.0

## 4.20.6

### Patch Changes

- [`80cde87e`](https://github.com/ethlete-io/ethdk/commit/80cde87ebf4f7ee2e31e74213f7c934596db1a16) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix allowSignalWrites errors happening when executing queries inside Angular computed and effect signal functions

## 4.20.5

### Patch Changes

- [`0328fb76`](https://github.com/ethlete-io/ethdk/commit/0328fb769ca53042835826c1967b8d2f25072d63) Thanks [@TomTomB](https://github.com/TomTomB)! - Dependency sync only

- Updated dependencies [[`0328fb76`](https://github.com/ethlete-io/ethdk/commit/0328fb769ca53042835826c1967b8d2f25072d63)]:
  - @ethlete/core@3.13.2
  - @ethlete/types@1.5.1

## 4.20.4

### Patch Changes

- [`38b06fc1`](https://github.com/ethlete-io/ethdk/commit/38b06fc1e6394fd3f6d71160cdb878658ca014a5) Thanks [@TomTomB](https://github.com/TomTomB)! - Add option to cache query response in queryStateResponseSignal util

## 4.20.3

### Patch Changes

- [`5936d5b8`](https://github.com/ethlete-io/ethdk/commit/5936d5b89351c06f020a0fe74638c84d8a8a479b) Thanks [@TomTomB](https://github.com/TomTomB)! - Auto stop polling of previous queries in query container handling

## 4.20.2

### Patch Changes

- [`977d82c9`](https://github.com/ethlete-io/ethdk/commit/977d82c9a4e14159db410b4267b23826c1fd1656) Thanks [@TomTomB](https://github.com/TomTomB)! - Add signal props to query form

## 4.20.1

### Patch Changes

- [`ea086dee`](https://github.com/ethlete-io/ethdk/commit/ea086deeb48283199a034611481dfdec59cb366c) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix signal writes in effect error sometimes happening inside query devtools

## 4.20.0

### Minor Changes

- [`48a2300d`](https://github.com/ethlete-io/ethdk/commit/48a2300d08c8474bccc6ef2e1dba729053690eaf) Thanks [@TomTomB](https://github.com/TomTomB)! - Add query state signal utils

## 4.19.0

### Minor Changes

- [`d2b07489`](https://github.com/ethlete-io/ethdk/commit/d2b074897bf92160140d58e46f6fbf8dcb598ddc) Thanks [@TomTomB](https://github.com/TomTomB)! - Add toQueryComputed util

## 4.18.0

### Minor Changes

- [`997a38a0`](https://github.com/ethlete-io/ethdk/commit/997a38a0bb4965a4ea1750af5d2daf4f4bdd11b2) Thanks [@TomTomB](https://github.com/TomTomB)! - Add updateBaseRoute function to query client class

## 4.17.0

### Minor Changes

- [`6da5a20a`](https://github.com/ethlete-io/ethdk/commit/6da5a20a720e5c86c6ed0bb4f9da1720b2ea7bd0) Thanks [@TomTomB](https://github.com/TomTomB)! - Add createQueryCollectionSubject and createQueryCollectionSignal. Deprecate createQueryCollection

## 4.16.3

### Patch Changes

- [`0955fdba`](https://github.com/ethlete-io/ethdk/commit/0955fdba6b551eadc826648de1fc3173cf88ba2e) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix error NG0600 sometimes happening due to query devtools being used

- [`7b4940c7`](https://github.com/ethlete-io/ethdk/commit/7b4940c7d02677fb5fa595a9cfd712316e4cf2b5) Thanks [@TomTomB](https://github.com/TomTomB)! - Auto exec cancelled queries inside query directive

## 4.16.2

### Patch Changes

- [`6b2a146a`](https://github.com/ethlete-io/ethdk/commit/6b2a146ad37f3d5668c55f49d15d8993142dea64) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix different queries colliding due to the same cache key being used

## 4.16.1

### Patch Changes

- [`1c49075d`](https://github.com/ethlete-io/ethdk/commit/1c49075df8726ba42dbb4e87ddbcb8d2c97853eb) Thanks [@TomTomB](https://github.com/TomTomB)! - Expose query store key in query devtools

## 4.16.0

### Minor Changes

- [`d37996f8`](https://github.com/ethlete-io/ethdk/commit/d37996f894cbb2ea4733f29a42459ab513a7ec61) Thanks [@TomTomB](https://github.com/TomTomB)! - Add skipQueryStore option to query prepare function

- [`099dc414`](https://github.com/ethlete-io/ethdk/commit/099dc4147b0f20b85a7df33b10545c7ac4c07daf) Thanks [@TomTomB](https://github.com/TomTomB)! - Add queryStoreCacheKey option to query.prepare function

## 4.15.0

### Minor Changes

- [`6d173535`](https://github.com/ethlete-io/ethdk/commit/6d173535eddbaf78a0526c8a35eefcb9f69f457f) Thanks [@TomTomB](https://github.com/TomTomB)! - Dependant tracking for queries

- [`a12e3a96`](https://github.com/ethlete-io/ethdk/commit/a12e3a965ab0a96cef3a9a82743907b8081edce7) Thanks [@TomTomB](https://github.com/TomTomB)! - Add toQuerySignal and toQueryObservable utils

## 4.14.0

### Minor Changes

- [`cd58186c`](https://github.com/ethlete-io/ethdk/commit/cd58186c99d285a6f467d05adc602757c8e0377b) Thanks [@TomTomB](https://github.com/TomTomB)! - Add activeFilterCount observable to query form and config options

- [`23a1a042`](https://github.com/ethlete-io/ethdk/commit/23a1a042066b4e6665f77fef6c6bb07003c72fa8) Thanks [@TomTomB](https://github.com/TomTomB)! - Add defaultFormValue property to query form

### Patch Changes

- [`55bc394e`](https://github.com/ethlete-io/ethdk/commit/55bc394ebd74fc032f8a51bfbdd31f93131ad72c) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix cancelled queries not being flagged as expired

- [`e1f5e6f3`](https://github.com/ethlete-io/ethdk/commit/e1f5e6f3d8ab2d22b9daeeeaac38d0df33a12bf8) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix query state not being updated to cancelled if query.abort gets called

## 4.13.1

### Patch Changes

- [`8a0ff346`](https://github.com/ethlete-io/ethdk/commit/8a0ff346ac30e721055f4631a0bb20a90154f2cf) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix this context getting lost inside query signal

## 4.13.0

### Minor Changes

- [#939](https://github.com/ethlete-io/ethdk/pull/939) [`d28b22cc`](https://github.com/ethlete-io/ethdk/commit/d28b22ccf468971978f03ee10feea1dc20c84c5b) Thanks [@nziermann](https://github.com/nziermann)! - Add query form patchValue and setValue functions

- [`351a29ae`](https://github.com/ethlete-io/ethdk/commit/351a29aebaaee67dbe9733773f5a082dcc8c6fcb) Thanks [@TomTomB](https://github.com/TomTomB)! - Auto execute prepared queries in query directive

### Patch Changes

- [`351a29ae`](https://github.com/ethlete-io/ethdk/commit/351a29aebaaee67dbe9733773f5a082dcc8c6fcb) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix queryCreator.querySignal returning void

## 4.12.0

### Minor Changes

- [`c9636e7c`](https://github.com/ethlete-io/ethdk/commit/c9636e7c49d3fa66e9cca2bfa1b0d7ced1036dbd) Thanks [@TomTomB](https://github.com/TomTomB)! - Add query creator helpers to create signals and subjects with the correct type

## 4.11.0

### Minor Changes

- [`7f4c8e57`](https://github.com/ethlete-io/ethdk/commit/7f4c8e57964bfbce7f4c87d3635fa40dda9dff6a) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix race condition issues within query forms using reset options

- [`4c6bd7fc`](https://github.com/ethlete-io/ethdk/commit/4c6bd7fc34f6d283ddd7b329e39337e0126ed5e2) Thanks [@TomTomB](https://github.com/TomTomB)! - Add additional cookie config options to bearer auth provider

### Patch Changes

- [`afaa63fe`](https://github.com/ethlete-io/ethdk/commit/afaa63febf31d106735ef8d63bf9a7075e01c54d) Thanks [@TomTomB](https://github.com/TomTomB)! - Dont sync query form with query params if syncOnNavigation is false

## 4.10.0

### Minor Changes

- [`5ce7a99d`](https://github.com/ethlete-io/ethdk/commit/5ce7a99d1f2af7db36a603a2d86a846451773f1e) Thanks [@TomTomB](https://github.com/TomTomB)! - Add option to disable query field debounce if the current value is falsy

### Patch Changes

- [`5ce7a99d`](https://github.com/ethlete-io/ethdk/commit/5ce7a99d1f2af7db36a603a2d86a846451773f1e) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix query field debounce option being ignored

- [`fbb6e036`](https://github.com/ethlete-io/ethdk/commit/fbb6e036ec8f7c48fc78dfb0c9562f004a13c5e8) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix query devtools host styles not being applied

## 4.9.2

### Patch Changes

- [`3e867c24`](https://github.com/ethlete-io/ethdk/commit/3e867c24d1c1e1ab15d6e89195f1e1c915963b98) Thanks [@TomTomB](https://github.com/TomTomB)! - Ensuce devtools color is not inherited

## 4.9.1

### Patch Changes

- [`97c4ca98`](https://github.com/ethlete-io/ethdk/commit/97c4ca98c130ead8b2f028b9f5741dfb3fe81eae) Thanks [@TomTomB](https://github.com/TomTomB)! - Retry failed requests if the status code is 0. This usually means the internet connection is down.

## 4.9.0

### Minor Changes

- [`13d92926`](https://github.com/ethlete-io/ethdk/commit/13d92926b3b9e5069c558db29dd43efa4d18a28e) Thanks [@TomTomB](https://github.com/TomTomB)! - Try parsing a blob error response to text or json

## 4.8.0

### Minor Changes

- [`0b492a8a`](https://github.com/ethlete-io/ethdk/commit/0b492a8afca14666ca2b0eb0bd2e987385caf2ef) Thanks [@TomTomB](https://github.com/TomTomB)! - Expose the query as template context in query directive

## 4.7.7

### Patch Changes

- [`b9d12840`](https://github.com/ethlete-io/ethdk/commit/b9d128404afd4e81e3c1a9c48694e92f1e56ad4a) Thanks [@TomTomB](https://github.com/TomTomB)! - Correctly display query entity store values

## 4.7.6

### Patch Changes

- [`d44c3f73`](https://github.com/ethlete-io/ethdk/commit/d44c3f736fe985801e8a5113e70a99fc43004c20) Thanks [@TomTomB](https://github.com/TomTomB)! - Display more infos inside query devtools

## 4.7.5

### Patch Changes

- [`3a91ef69`](https://github.com/ethlete-io/ethdk/commit/3a91ef697372516acf008cff13bb1beb5c213e3b) Thanks [@TomTomB](https://github.com/TomTomB)! - Query devtools styling

## 4.7.4

### Patch Changes

- [`c313b2a9`](https://github.com/ethlete-io/ethdk/commit/c313b2a90d7c79ef1fafaf055fd29bf97b1b87a6) Thanks [@TomTomB](https://github.com/TomTomB)! - Add history tab to query dev tools

## 4.7.3

### Patch Changes

- [`3e32aace`](https://github.com/ethlete-io/ethdk/commit/3e32aace4383d5737da31167054cf13f60491d9b) Thanks [@TomTomB](https://github.com/TomTomB)! - Dont complete the query state if there are no mo subs

## 4.7.2

### Patch Changes

- [`b35ad3ed`](https://github.com/ethlete-io/ethdk/commit/b35ad3ed99ae77f6de5616e342016579c48713eb) Thanks [@TomTomB](https://github.com/TomTomB)! - Correctly count subs to queries

## 4.7.1

### Patch Changes

- [`75060b55`](https://github.com/ethlete-io/ethdk/commit/75060b556ceee3dcedac597606f3402f5d6fdaf1) Thanks [@TomTomB](https://github.com/TomTomB)! - Add query devtools window controls

## 4.7.0

### Minor Changes

- [`0a41838`](https://github.com/ethlete-io/ethdk/commit/0a41838f9606a83969ccfbaa16fc244602dc242e) Thanks [@TomTomB](https://github.com/TomTomB)! - Add first query dev tools prototype

### Patch Changes

- [`4cbaaa1`](https://github.com/ethlete-io/ethdk/commit/4cbaaa13e2b75f458ee6e0a29a888281c0a35b29) Thanks [@TomTomB](https://github.com/TomTomB)! - Add logging option to warn if a prepared query gets subscribed to

## 4.6.1

### Patch Changes

- [`fbb4ddd`](https://github.com/ethlete-io/ethdk/commit/fbb4ddd369b6cfac6f5ad0bd97075977a6680dab) Thanks [@TomTomB](https://github.com/TomTomB)! - Dont use stringified arrays for form values inside query form

## 4.6.0

### Minor Changes

- [`4cfa473`](https://github.com/ethlete-io/ethdk/commit/4cfa473379d5cde9e0c2523a39d2d18b1dfe739b) Thanks [@TomTomB](https://github.com/TomTomB)! - Expose current scope from query collections inside query directive

- [`f178ff2`](https://github.com/ethlete-io/ethdk/commit/f178ff20e08ac83b3fdbe19f28851c74d93163d6) Thanks [@TomTomB](https://github.com/TomTomB)! - Add error utils

## 4.5.0

### Minor Changes

- [`50f245b`](https://github.com/ethlete-io/ethdk/commit/50f245bac97c8221b3ce5a93001e7bf79a1f144e) Thanks [@TomTomB](https://github.com/TomTomB)! - Add options to ignore query string values

## 4.4.2

### Patch Changes

- [`6d80535`](https://github.com/ethlete-io/ethdk/commit/6d80535c71a25b3cf89d8ff3063c891f4d7a1d21) Thanks [@TomTomB](https://github.com/TomTomB)! - Check infinity query state map before accessing its last item

- [`74ac516`](https://github.com/ethlete-io/ethdk/commit/74ac516908fe4b7a3b98a08facdb4601f09b34ea) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix type issues inside infinity query

## 4.4.1

### Patch Changes

- [`c3c73d2`](https://github.com/ethlete-io/ethdk/commit/c3c73d2096ac09eb27dd683361dde0fa73d47374) Thanks [@TomTomB](https://github.com/TomTomB)! - Forward query param config from client to query creation

## 4.4.0

### Minor Changes

- [`a8ec09f`](https://github.com/ethlete-io/ethdk/commit/a8ec09fd5e0244cc61b0717e0521a96cab53c99e) Thanks [@TomTomB](https://github.com/TomTomB)! - Expose current arguments inside infinityy query total pages extractor fn

- [`5225442`](https://github.com/ethlete-io/ethdk/commit/52254425d1de386e303c9132637ddcd3bb87ec96) Thanks [@TomTomB](https://github.com/TomTomB)! - Add config options on how to parse query params

## 4.3.4

### Patch Changes

- [`4ee8a13`](https://github.com/ethlete-io/ethdk/commit/4ee8a13e262f0dabcd16330f446469a5bae5a44c) Thanks [@TomTomB](https://github.com/TomTomB)! - Set query directive loading only to true if it's not refreshing

## 4.3.3

### Patch Changes

- [`73f9648`](https://github.com/ethlete-io/ethdk/commit/73f964844dd0c807187a6a829e522f637ef89516) Thanks [@TomTomB](https://github.com/TomTomB)! - (internal changes only)

## 4.3.2

### Patch Changes

- [`880e695`](https://github.com/ethlete-io/ethdk/commit/880e695fc047df4bb04d85e76a42abfcc3d064fc) Thanks [@TomTomB](https://github.com/TomTomB)! - Return the current query inside bearer auth provider if its currently loading

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
