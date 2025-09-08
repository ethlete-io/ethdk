# @ethlete/core

## 4.29.7

### Patch Changes

- [`b79cf6a`](https://github.com/ethlete-io/ethdk/commit/b79cf6a845496d4e5c1df63c851c96dceba50881) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix router event signal skipping the initial navigation

## 4.29.6

### Patch Changes

- [`452c6f9`](https://github.com/ethlete-io/ethdk/commit/452c6f9d3ff446fee37b719c233daf1216930e98) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix initial values inside router state being null by default

## 4.29.5

### Patch Changes

- [`0ffe4f9`](https://github.com/ethlete-io/ethdk/commit/0ffe4f9b629ab47e0632fa1fdb8eb99a6552ca4b) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix router state not getting updated on initial load once the router is ready

## 4.29.4

### Patch Changes

- [`183ca54`](https://github.com/ethlete-io/ethdk/commit/183ca540f7d4bd3a760a2f37fc28fac80b937d34) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix initial values of router signals

## 4.29.3

### Patch Changes

- [`6b05b76`](https://github.com/ethlete-io/ethdk/commit/6b05b7603cfd0038dda1336c7c0acf590556a4fa) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix `controlValueSignal` not reporting the initial value if the passed control is a required input

## 4.29.2

### Patch Changes

- [`11dc4d3`](https://github.com/ethlete-io/ethdk/commit/11dc4d32d6ae7f3681c50029d3c7e2468cbec3a0) Thanks [@TomTomB](https://github.com/TomTomB)! - Raise an error if signal utils detect a non html element being used as an element

## 4.29.1

### Patch Changes

- [`25546d0`](https://github.com/ethlete-io/ethdk/commit/25546d09c1f996393db7b979e8c996bd36db39b1) Thanks [@TomTomB](https://github.com/TomTomB)! - Try to read the control passed to `controlValueSignal` synchronous for using its value as initial value instead of always using `null`.

## 4.29.0

### Minor Changes

- [`10802c0`](https://github.com/ethlete-io/ethdk/commit/10802c0ecef8907b2ab27f42680aa5b47db76f7d) Thanks [@TomTomB](https://github.com/TomTomB)! - Update to Angular v20

## 4.28.0

### Minor Changes

- [`b746fd5`](https://github.com/ethlete-io/ethdk/commit/b746fd56098c25252eb0169a4d0d019f86b5bc22) Thanks [@TomTomB](https://github.com/TomTomB)! - Add time to `signalElementLastScrollDirection` util

## 4.27.1

### Patch Changes

- [`03fcea4`](https://github.com/ethlete-io/ethdk/commit/03fcea4f680ded762296e9a643e1b66456a87f92) Thanks [@TomTomB](https://github.com/TomTomB)! - Update the url of injectUrl if the navigation gets skipped

## 4.27.0

### Minor Changes

- [`58cafaa`](https://github.com/ethlete-io/ethdk/commit/58cafaa7db6d339798425ba7b24e153c54e646ee) Thanks [@TomTomB](https://github.com/TomTomB)! - Add `signalElementLastScrollDirection` and `signalHostElementLastScrollDirection` utils

## 4.26.1

### Patch Changes

- [`7bac305`](https://github.com/ethlete-io/ethdk/commit/7bac305e9d5777607e8d867ce70660f9162b0a19) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix flickering when opening a toggletip

## 4.26.0

### Minor Changes

- [`19d461c`](https://github.com/ethlete-io/ethdk/commit/19d461c3f942ed2ed67793a3d8b7e7232158f82b) Thanks [@TomTomB](https://github.com/TomTomB)! - Add media query utils `injectIsPortrait`, `injectIsLandscape`, `injectDisplayOrientation`, `injectHasTouchInput`, `injectHasPrecisionInput`, `injectDeviceInputType` and `injectCanHover`

## 4.25.1

### Patch Changes

- [`91b6a3b`](https://github.com/ethlete-io/ethdk/commit/91b6a3ba51f6a60abe71b27d1eb88099e29b2418) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix class defines

## 4.25.0

### Minor Changes

- [`40fd002`](https://github.com/ethlete-io/ethdk/commit/40fd0023407ff7c9aa652a74317861ffd0d1abbf) Thanks [@TomTomB](https://github.com/TomTomB)! - Add logger util

## 4.24.1

### Patch Changes

- [`4e688a1`](https://github.com/ethlete-io/ethdk/commit/4e688a1bfb8ff20af33852f5beef4d0b766027d9) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix sidebar dialogs not showing up

## 4.24.0

### Minor Changes

- [`1dd18fb`](https://github.com/ethlete-io/ethdk/commit/1dd18fb077b9b377384daac8eacae5732d7e7a3a) Thanks [@TomTomB](https://github.com/TomTomB)! - Update angular 19

## 4.23.8

### Patch Changes

- [`f923dd1`](https://github.com/ethlete-io/ethdk/commit/f923dd144bea5ea60ad85dfbaed5a46370e744eb) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix mime type inferring for srcsets with modifiers like x1 and 320w

## 4.23.7

### Patch Changes

- [`45e7631`](https://github.com/ethlete-io/ethdk/commit/45e7631063df1b55c8697c300cbbe0b3a2d89732) Thanks [@TomTomB](https://github.com/TomTomB)! - Allow a `fm` query param to be anywhere inside the query string, not just at the beginning for the `inferMimeType` util

## 4.23.6

### Patch Changes

- [`bedc406`](https://github.com/ethlete-io/ethdk/commit/bedc4061e38b9da67e270c9689af789bb384db67) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix mime types not getting inferred for some urls

## 4.23.5

### Patch Changes

- [`6d4bc5c`](https://github.com/ethlete-io/ethdk/commit/6d4bc5c468263814a95ceb116829758e079bb793) Thanks [@TomTomB](https://github.com/TomTomB)! - Fail silently inside `syncSignal` if the initial read fails. This will log a warning in dev mode. Set `skipSyncRead` to `true` to skip the initial read.

## 4.23.4

### Patch Changes

- [`1c250cd`](https://github.com/ethlete-io/ethdk/commit/1c250cd0ca1c34dc0404dd3254b6a3f6434b1f49) Thanks [@TomTomB](https://github.com/TomTomB)! - Clear selection inside selection model in single select mode if the selected value does not exist

## 4.23.3

### Patch Changes

- [`0ff7785`](https://github.com/ethlete-io/ethdk/commit/0ff7785431e71abcd45cf72d21e4ef200c7dac81) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix combobox track by function warnings getting spammed in the console.

## 4.23.2

### Patch Changes

- [`bf2aa1b`](https://github.com/ethlete-io/ethdk/commit/bf2aa1bdef86edb4b633105b4377117b78245699) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix scroll blocking and focus traps when overlays are open

## 4.23.1

### Patch Changes

- [`4f4c337`](https://github.com/ethlete-io/ethdk/commit/4f4c3376b8b7d6f507e51a654a4322d25ee3f51e) Thanks [@TomTomB](https://github.com/TomTomB)! - Deprecate LetDirective

## 4.23.0

### Minor Changes

- [`2032030`](https://github.com/ethlete-io/ethdk/commit/203203080dcd1e1b800135667a84232074f9250f) Thanks [@TomTomB](https://github.com/TomTomB)! - Add referenceElement input to animated overlay directive

## 4.22.0

### Minor Changes

- [`3c4cafe`](https://github.com/ethlete-io/ethdk/commit/3c4cafeaabd66378b5f8a7df0a4297609da43022) Thanks [@TomTomB](https://github.com/TomTomB)! - Add `injectUrl` util

- [`3c4cafe`](https://github.com/ethlete-io/ethdk/commit/3c4cafeaabd66378b5f8a7df0a4297609da43022) Thanks [@TomTomB](https://github.com/TomTomB)! - Add `injectQueryParamChanges` util

- [`3c4cafe`](https://github.com/ethlete-io/ethdk/commit/3c4cafeaabd66378b5f8a7df0a4297609da43022) Thanks [@TomTomB](https://github.com/TomTomB)! - Remove the option to pass an injector to router inject utils

- [`3c4cafe`](https://github.com/ethlete-io/ethdk/commit/3c4cafeaabd66378b5f8a7df0a4297609da43022) Thanks [@TomTomB](https://github.com/TomTomB)! - Add `injectRoute` util

- [`3c4cafe`](https://github.com/ethlete-io/ethdk/commit/3c4cafeaabd66378b5f8a7df0a4297609da43022) Thanks [@TomTomB](https://github.com/TomTomB)! - Add `injectRouterEvent` util

- [`3c4cafe`](https://github.com/ethlete-io/ethdk/commit/3c4cafeaabd66378b5f8a7df0a4297609da43022) Thanks [@TomTomB](https://github.com/TomTomB)! - Add `injectPathParamChanges` util

- [`3c4cafe`](https://github.com/ethlete-io/ethdk/commit/3c4cafeaabd66378b5f8a7df0a4297609da43022) Thanks [@TomTomB](https://github.com/TomTomB)! - Remove `injectOrRunInContext` util

- [`3c4cafe`](https://github.com/ethlete-io/ethdk/commit/3c4cafeaabd66378b5f8a7df0a4297609da43022) Thanks [@TomTomB](https://github.com/TomTomB)! - Add `injectRouterState` util

## 4.21.4

### Patch Changes

- [`5ce9f36`](https://github.com/ethlete-io/ethdk/commit/5ce9f36a62797e734ad624346139c7a3884caa4f) Thanks [@TomTomB](https://github.com/TomTomB)! - Update to angular 18.1

## 4.21.3

### Patch Changes

- [`9f88907`](https://github.com/ethlete-io/ethdk/commit/9f889073e1a32afacd35ef3fdbb0a4f21ea4ade3) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix `controlValueSignal` not including disabled form control values

## 4.21.2

### Patch Changes

- [`69ee325`](https://github.com/ethlete-io/ethdk/commit/69ee32561bf0df78569a1649053a37edf9741b9c) Thanks [@TomTomB](https://github.com/TomTomB)! - Bump only for updating peer deps

## 4.21.1

### Patch Changes

- [`42a4415`](https://github.com/ethlete-io/ethdk/commit/42a44152807316c57a739ae9ccc6e607ec934141) Thanks [@TomTomB](https://github.com/TomTomB)! - Do not debounce by default inside `controlValueSignal` util.

## 4.21.0

### Minor Changes

- [`88730d5`](https://github.com/ethlete-io/ethdk/commit/88730d5b4110c4fd29185caad403feabf7695bf5) Thanks [@TomTomB](https://github.com/TomTomB)! - Add support for required input signals inside `controlValueSignal`

### Patch Changes

- [`88730d5`](https://github.com/ethlete-io/ethdk/commit/88730d5b4110c4fd29185caad403feabf7695bf5) Thanks [@TomTomB](https://github.com/TomTomB)! - Return the effect ref created inside `syncSignal`

## 4.20.0

### Minor Changes

- [#1917](https://github.com/ethlete-io/ethdk/pull/1917) [`5d6d49e`](https://github.com/ethlete-io/ethdk/commit/5d6d49eb030e5d4530e1fedca41902a9974b4f95) Thanks [@Gw3i](https://github.com/Gw3i)! - Add signal type for control parameter for `controlValueSignal`

## 4.19.4

### Patch Changes

- [`8bc0c1d`](https://github.com/ethlete-io/ethdk/commit/8bc0c1dfa133c2de51980f3ff75e1465201289f2) Thanks [@TomTomB](https://github.com/TomTomB)! - Correctly apply the default debounce to `controlValueSignal`

## 4.19.3

### Patch Changes

- [`ba2e546`](https://github.com/ethlete-io/ethdk/commit/ba2e54669666038da926808fcfdeacac93483eb3) Thanks [@TomTomB](https://github.com/TomTomB)! - Enhance performance by caching `getBoundingClientRect()` calls

## 4.19.2

### Patch Changes

- [`8a08672`](https://github.com/ethlete-io/ethdk/commit/8a086726225de55877358780bfbc5a624d8f56d5) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix styles not getting cleaned up inside signal styles util

## 4.19.1

### Patch Changes

- [`241b099`](https://github.com/ethlete-io/ethdk/commit/241b09936c7e49b0adafb53b6124542a904e324c) Thanks [@TomTomB](https://github.com/TomTomB)! - Performance enhancements for signal utils

## 4.19.0

### Minor Changes

- [`56dd26e`](https://github.com/ethlete-io/ethdk/commit/56dd26ec34310da6d344c4851a7e34518c88b678) Thanks [@TomTomB](https://github.com/TomTomB)! - Add `deferredSignal` util

## 4.18.4

### Patch Changes

- [`142b855`](https://github.com/ethlete-io/ethdk/commit/142b855bd19a219eb90d56999724001a8ce5e50b) Thanks [@TomTomB](https://github.com/TomTomB)! - Return the state signal as read only inside `createCanAnimateSignal` function. This value should not be modified by the user.

## 4.18.3

### Patch Changes

- [`9f8f7ee`](https://github.com/ethlete-io/ethdk/commit/9f8f7ee6bb6bcd494709f822b861ef023b717254) Thanks [@TomTomB](https://github.com/TomTomB)! - Remove temp logging

## 4.18.2

### Patch Changes

- [`92709a5`](https://github.com/ethlete-io/ethdk/commit/92709a53c8f9a32afa72ca509387be3d7b4b0217) Thanks [@TomTomB](https://github.com/TomTomB)! - Add signal util logging

## 4.18.1

### Patch Changes

- [`2c27678`](https://github.com/ethlete-io/ethdk/commit/2c27678f9e48f241df37073d43f736c9d08f3511) Thanks [@TomTomB](https://github.com/TomTomB)! - disable user select and user drag once cursor dragging is started

## 4.18.0

### Minor Changes

- [`1aaff43`](https://github.com/ethlete-io/ethdk/commit/1aaff43d46418a17c84eb5edfd7ae38e7226d093) Thanks [@TomTomB](https://github.com/TomTomB)! - Add signal viewport utils:
  - `injectIsXs()`
  - `injectIsSm()`
  - `injectIsMd()`
  - `injectIsLg()`
  - `injectIsXl()`
  - `injectIs2Xl()`
  - `injectBreakpointIsMatched()`
  - `injectObserveBreakpoint()`
  - `injectCurrentBreakpoint()`

### Patch Changes

- [`d7ea5c7`](https://github.com/ethlete-io/ethdk/commit/d7ea5c74b2a76354b74956ce01ec95a37b04c42e) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix cursor drag getting stuck due due to it being statet on a anchor html element

- [`d7ea5c7`](https://github.com/ethlete-io/ethdk/commit/d7ea5c74b2a76354b74956ce01ec95a37b04c42e) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix intersection observer entries getting out of order if elements change after the first render

## 4.17.0

### Minor Changes

- [`aeb1134`](https://github.com/ethlete-io/ethdk/commit/aeb1134f80f0bcf53e11131d64b8b2d8c1434295) Thanks [@TomTomB](https://github.com/TomTomB)! - Add computedTillFalsy util

- [`aeb1134`](https://github.com/ethlete-io/ethdk/commit/aeb1134f80f0bcf53e11131d64b8b2d8c1434295) Thanks [@TomTomB](https://github.com/TomTomB)! - Add computedTillTruthy util

## 4.16.0

### Minor Changes

- [`bc0c0c6`](https://github.com/ethlete-io/ethdk/commit/bc0c0c69bdaaa11e1f6808a49da1b2255f795ed5) Thanks [@TomTomB](https://github.com/TomTomB)! - Add useCursorDragScroll as a replacement for the CursorDragScrollDirective

### Patch Changes

- [`c6530e0`](https://github.com/ethlete-io/ethdk/commit/c6530e02d0c3f6e8303f87967891dc307017dc0a) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix endless loop when using signalElementIntersection in certain cases

## 4.15.0

### Minor Changes

- [`6a46084`](https://github.com/ethlete-io/ethdk/commit/6a460843b241a14ba550d8c82ec5df74f1945229) Thanks [@TomTomB](https://github.com/TomTomB)! - Add `getElementScrollCoordinates` util. This util computes a `ScrollToOptions` object based on the provided element and scrollable container. This object can be used to scroll the scrollable container to the element.

### Patch Changes

- [`6a46084`](https://github.com/ethlete-io/ethdk/commit/6a460843b241a14ba550d8c82ec5df74f1945229) Thanks [@TomTomB](https://github.com/TomTomB)! - Use renderer instead of setting properties directly using native dom apis inside signal utils

## 4.14.0

### Minor Changes

- [`abb8d8c`](https://github.com/ethlete-io/ethdk/commit/abb8d8c1ceac7f2d482b153991ed7a4222d409c9) Thanks [@TomTomB](https://github.com/TomTomB)! - Support multiple elements inside `signalAttributes` and `signalStyles` util

## 4.13.0

### Minor Changes

- [`bc0339f`](https://github.com/ethlete-io/ethdk/commit/bc0339f854fa6f69543187206df0025c4be9c551) Thanks [@TomTomB](https://github.com/TomTomB)! - Add `initialScrollPosition` option to `signalElementScrollState` util

- [`bc0339f`](https://github.com/ethlete-io/ethdk/commit/bc0339f854fa6f69543187206df0025c4be9c551) Thanks [@TomTomB](https://github.com/TomTomB)! - Return initial intersections sync when using `signalElementIntersection` util

- [`52840d2`](https://github.com/ethlete-io/ethdk/commit/52840d26ea4390a92a497f5940dc5d3921b69c8f) Thanks [@TomTomB](https://github.com/TomTomB)! - Support multiple elements inside `signalClasses` util

- [`bc0339f`](https://github.com/ethlete-io/ethdk/commit/bc0339f854fa6f69543187206df0025c4be9c551) Thanks [@TomTomB](https://github.com/TomTomB)! - Add `createCanAnimateSignal` util

- [`bc0339f`](https://github.com/ethlete-io/ethdk/commit/bc0339f854fa6f69543187206df0025c4be9c551) Thanks [@TomTomB](https://github.com/TomTomB)! - Add `createIsRenderedSignal` util

## 4.12.1

### Patch Changes

- [`c8d8395`](https://github.com/ethlete-io/ethdk/commit/c8d8395b07e4b87885c59bf446b3a54854e20980) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix typings for injectQueryParam

## 4.12.0

### Minor Changes

- [#1792](https://github.com/ethlete-io/ethdk/pull/1792) [`69f4c3a`](https://github.com/ethlete-io/ethdk/commit/69f4c3ab1227f915edac10f1d335beabae69bc47) Thanks [@Marc-BrauneDigital](https://github.com/Marc-BrauneDigital)! - Rename `getFirstAndLastPartialIntersection` to `getIntersectionInfo` and return additional information about the intersection. This change is backward compatible.

- [`dc5e27f`](https://github.com/ethlete-io/ethdk/commit/dc5e27ffa0a4b94a8dabab68295e6510f34a20c0) Thanks [@TomTomB](https://github.com/TomTomB)! - Add signal utils for injecting router data. Data can be transformed just like Angular inputs using the `transform` option.
  - `injectQueryParams()`
  - `injectQueryParam()`
  - `injectPathParams()`
  - `injectPathParam()`
  - `injectRouteData()`
  - `injectRouteDataItem()`
  - `injectFragment()`
  - `injectRouteTitle()`

## 4.11.0

### Minor Changes

- [`4fc95a8`](https://github.com/ethlete-io/ethdk/commit/4fc95a85c6c6181585e205b6cd1db2ee83964bd4) Thanks [@TomTomB](https://github.com/TomTomB)! - Emit state change events inside animated lifecycle directive

- [`4fc95a8`](https://github.com/ethlete-io/ethdk/commit/4fc95a85c6c6181585e205b6cd1db2ee83964bd4) Thanks [@TomTomB](https://github.com/TomTomB)! - Add isActive property to carousel item directive

## 4.10.0

### Minor Changes

- [`689ecc1`](https://github.com/ethlete-io/ethdk/commit/689ecc1d7480e56a871ba46cd75a0c26c200d198) Thanks [@TomTomB](https://github.com/TomTomB)! - Remove style bindings that would result in null or undefined

## 4.9.0

### Minor Changes

- [`67e00ce`](https://github.com/ethlete-io/ethdk/commit/67e00ce24def5d7f274195f29eb44139f891446f) Thanks [@TomTomB](https://github.com/TomTomB)! - Add `isObject`, `isArray` and `getObjectProperty` utils

## 4.8.0

### Minor Changes

- [`9ee71f4`](https://github.com/ethlete-io/ethdk/commit/9ee71f413d8046a8ccdcabbc9ab6258692efd832) Thanks [@TomTomB](https://github.com/TomTomB)! - Add `injectHostElement` and `injectTemplateRef` utils

- [`9509b78`](https://github.com/ethlete-io/ethdk/commit/9509b78b9f0b65a553b6afba10866461441bee88) Thanks [@TomTomB](https://github.com/TomTomB)! - Add `controlValueSignal` and `controlValueSignalWithPrevious` utils

### Patch Changes

- [`b2828c8`](https://github.com/ethlete-io/ethdk/commit/b2828c8807a3fdba53bf07ef3291872a19a8d8ba) Thanks [@TomTomB](https://github.com/TomTomB)! - Auto close tooltips ans toggletips as soon as their reference element exits the viewport

## 4.7.0

### Minor Changes

- [`969c3ef`](https://github.com/ethlete-io/ethdk/commit/969c3ef83bfc0840e5fa658484a27a50bebf72f7) Thanks [@TomTomB](https://github.com/TomTomB)! - Add `skipNextEnter` option to `AnimatedLifecycleDirective`

## 4.6.0

### Minor Changes

- [#1640](https://github.com/ethlete-io/ethdk/pull/1640) [`7c1214a`](https://github.com/ethlete-io/ethdk/commit/7c1214a8c8107591986e811e8a63629fcc251077) Thanks [@Gw3i](https://github.com/Gw3i)! - Add `debouncedControlValueSignal` util

## 4.5.2

### Patch Changes

- [#1614](https://github.com/ethlete-io/ethdk/pull/1614) [`5f414b9`](https://github.com/ethlete-io/ethdk/commit/5f414b96362366f650945835b87d3cf8ce292bc1) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix various circular dependencies

## 4.5.1

### Patch Changes

- [`4ef84f5`](https://github.com/ethlete-io/ethdk/commit/4ef84f5e63a82e80f5125457a0b8f35a23b05010) Thanks [@TomTomB](https://github.com/TomTomB)! - Add missing export

## 4.5.0

### Minor Changes

- [`526f8db`](https://github.com/ethlete-io/ethdk/commit/526f8dbf3e511302bc765ffc8401b7c91c22c814) Thanks [@TomTomB](https://github.com/TomTomB)! - Add option to set same site option in cookie util

- [`9bc5fd0`](https://github.com/ethlete-io/ethdk/commit/9bc5fd0741444afebe34bf9a926f1e744cba7e84) Thanks [@TomTomB](https://github.com/TomTomB)! - Add createComponentId util

## 4.4.1

### Patch Changes

- [`55f4e8c`](https://github.com/ethlete-io/ethdk/commit/55f4e8c67591acb955cf5844e2ce3b08eb04f059) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix `etAnimatedIf` directive missing `ngIf` as host directive

## 4.4.0

### Minor Changes

- [`00b4ebf5`](https://github.com/ethlete-io/ethdk/commit/00b4ebf5ab2ff363b01c5ef24e777e96d77223a5) Thanks [@TomTomB](https://github.com/TomTomB)! - Add option to disable `shift` inside `AnimatedOverlayDirective`

### Patch Changes

- [`57cecd4c`](https://github.com/ethlete-io/ethdk/commit/57cecd4c6e529c97af730c9280aee1bdaebd7e59) Thanks [@TomTomB](https://github.com/TomTomB)! - Don't check for children in `signalElementChildren` util if the component is not yet rendered

## 4.3.0

### Minor Changes

- [`7806a21d`](https://github.com/ethlete-io/ethdk/commit/7806a21db827e68002c512ffe6ad86bae072755b) Thanks [@TomTomB](https://github.com/TomTomB)! - Add `signalElementChildren` util

- [`89fea95d`](https://github.com/ethlete-io/ethdk/commit/89fea95d371e43a52eb5bfa9c049d6f3b6068554) Thanks [@TomTomB](https://github.com/TomTomB)! - Add `getFirstAndLastPartialIntersection` util

## 4.2.3

### Patch Changes

- [`db305a50`](https://github.com/ethlete-io/ethdk/commit/db305a50f6cb17e35036288443f9f9b12f8b511c) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix nearest scrolling in `scrollToElement` util

## 4.2.2

### Patch Changes

- [`7c9ac832`](https://github.com/ethlete-io/ethdk/commit/7c9ac8320faf63447c69928160c9eda0354e39d0) Thanks [@TomTomB](https://github.com/TomTomB)! - Allow setting a `SignalElementBinding` as root for the `signalElementIntersection` method instead of only allowing the `HTMLElement` type

## 4.2.1

### Patch Changes

- [`da7616e2`](https://github.com/ethlete-io/ethdk/commit/da7616e2181607ebef184be314102806abebdd27) Thanks [@TomTomB](https://github.com/TomTomB)! - Cleanup signal utils and types

## 4.2.0

### Minor Changes

- [`8a714a01`](https://github.com/ethlete-io/ethdk/commit/8a714a0147a58fa84c9258fd4b14ffdc835b3442) Thanks [@TomTomB](https://github.com/TomTomB)! - Update to Angular 17

- [`e7b4e79b`](https://github.com/ethlete-io/ethdk/commit/e7b4e79b282b8b650b8a0596e07b32ffaefeedd5) Thanks [@TomTomB](https://github.com/TomTomB)! - Add signal utils for `signalElementMutations`, `signalElementScrollState` and `signalElementIntersection`

## 4.1.0

### Minor Changes

- [`873b108b`](https://github.com/ethlete-io/ethdk/commit/873b108b2df3c2aa242ad9a38ae621d40e169119) Thanks [@TomTomB](https://github.com/TomTomB)! - Add `signalElementDimensions()` and `signalHostElementDimensions()` utils

## 4.0.3

### Patch Changes

- Updated dependencies [[`ce7e1055`](https://github.com/ethlete-io/ethdk/commit/ce7e1055cc24018d8e0ac3550a7ceb8ad96253f0)]:
  - @ethlete/types@1.6.2

## 4.0.2

### Patch Changes

- Updated dependencies [[`3216a9aa`](https://github.com/ethlete-io/ethdk/commit/3216a9aaa6baa0c846d1702562b3959bec5fbac7)]:
  - @ethlete/types@1.6.1

## 4.0.1

### Patch Changes

- [`3f77e8d5`](https://github.com/ethlete-io/ethdk/commit/3f77e8d52a5ba45c4f3da4e34dcc08e0561ae04d) Thanks [@TomTomB](https://github.com/TomTomB)! - Init router state with data from window.location

## 4.0.0

### Patch Changes

- Updated dependencies [[`82f62921`](https://github.com/ethlete-io/ethdk/commit/82f629215c085a4f6d78f36a8981e34f4e626bbd)]:
  - @ethlete/types@1.6.0

## 3.13.2

### Patch Changes

- [`0328fb76`](https://github.com/ethlete-io/ethdk/commit/0328fb769ca53042835826c1967b8d2f25072d63) Thanks [@TomTomB](https://github.com/TomTomB)! - Dependency sync only

- Updated dependencies [[`0328fb76`](https://github.com/ethlete-io/ethdk/commit/0328fb769ca53042835826c1967b8d2f25072d63)]:
  - @ethlete/theming@2.3.1
  - @ethlete/types@1.5.1

## 3.13.1

### Patch Changes

- [`acfb8522`](https://github.com/ethlete-io/ethdk/commit/acfb852234a177ba9d4b4fab78905a586656a9fa) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix selection model options always being disabled

## 3.13.0

### Minor Changes

- [`3a827a8e`](https://github.com/ethlete-io/ethdk/commit/3a827a8e2fd23186e2c83ffacff45d0c791f2f47) Thanks [@TomTomB](https://github.com/TomTomB)! - Add RootBoundaryDirective

### Patch Changes

- [`2b56c1d8`](https://github.com/ethlete-io/ethdk/commit/2b56c1d86b6d1c23aa8b924a959d75328a401ee2) Thanks [@TomTomB](https://github.com/TomTomB)! - Minor selection model enhancements

- [`3a827a8e`](https://github.com/ethlete-io/ethdk/commit/3a827a8e2fd23186e2c83ffacff45d0c791f2f47) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix overlays not being positioned correctly inside an other overlay

## 3.12.0

### Minor Changes

- [#1034](https://github.com/ethlete-io/ethdk/pull/1034) [`1d69f6c1`](https://github.com/ethlete-io/ethdk/commit/1d69f6c129eb4457a5089083813fc3ff6e65bd41) Thanks [@Marc-BrauneDigital](https://github.com/Marc-BrauneDigital)! - Add inferMimeTypePipe and util

## 3.11.2

### Patch Changes

- [`1a92753f`](https://github.com/ethlete-io/ethdk/commit/1a92753faaf16977fe59af0080c03ba3244b642c) Thanks [@TomTomB](https://github.com/TomTomB)! - Add function to set the active option inside active selection model

## 3.11.1

### Patch Changes

- [`df887bf2`](https://github.com/ethlete-io/ethdk/commit/df887bf295417edf634d0a2b7be3d94739548fa1) Thanks [@TomTomB](https://github.com/TomTomB)! - Add missing support for theming inside overlays

## 3.11.0

### Minor Changes

- [`e5cc3133`](https://github.com/ethlete-io/ethdk/commit/e5cc3133a7fe81d008644da1be2fcdfb3e4cb3d8) Thanks [@TomTomB](https://github.com/TomTomB)! - Add angular utils

### Patch Changes

- [`f1b8cd9f`](https://github.com/ethlete-io/ethdk/commit/f1b8cd9f401b0c75a4d4621fe585baaa82b2f111) Thanks [@TomTomB](https://github.com/TomTomB)! - Switch from createReactiveBindings to signal versions

## 3.10.0

### Minor Changes

- [`12f0305c`](https://github.com/ethlete-io/ethdk/commit/12f0305cb96e22b845634b2b10ca40a38316048d) Thanks [@TomTomB](https://github.com/TomTomB)! - Expose current visibility in observe visibility directive

## 3.9.0

### Minor Changes

- [`9370f45e`](https://github.com/ethlete-io/ethdk/commit/9370f45eb349441f8907ea4f404a5ab66ecca2e9) Thanks [@TomTomB](https://github.com/TomTomB)! - Add getFormGroupValue util that includes undefined values

## 3.8.1

### Patch Changes

- [`986f3fcd`](https://github.com/ethlete-io/ethdk/commit/986f3fcdf694415ece4182b00261b9f9911c71b0) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix animated lifecycle getting stuck if leave is triggered while entering is active

## 3.8.0

### Minor Changes

- [`fe654949`](https://github.com/ethlete-io/ethdk/commit/fe654949e47909e82a00de34aed1894c5d4afeb7) Thanks [@TomTomB](https://github.com/TomTomB)! - Add signal utils for manipulating classes and attributes of elements

## 3.7.0

### Minor Changes

- [`0397e8c7`](https://github.com/ethlete-io/ethdk/commit/0397e8c73c8e239fe4df92718127cd397519d549) Thanks [@TomTomB](https://github.com/TomTomB)! - Add additional properties to visibility observer events

## 3.6.1

### Patch Changes

- [`63067a60`](https://github.com/ethlete-io/ethdk/commit/63067a609227694a897c8cfcd425250f1eaff7d2) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix initial visibility change event value

## 3.6.0

### Minor Changes

- [`ef7716c9`](https://github.com/ethlete-io/ethdk/commit/ef7716c9eca17fbf62c8ce1647e6865ad8189d47) Thanks [@TomTomB](https://github.com/TomTomB)! - Add observe visibility directive and intersection observer service

## 3.5.0

### Minor Changes

- [`116b3802`](https://github.com/ethlete-io/ethdk/commit/116b380246675ad2c9ad105b76a3a0fcd6260e99) Thanks [@TomTomB](https://github.com/TomTomB)! - Add createResizeObservable util

- [`4a705a0b`](https://github.com/ethlete-io/ethdk/commit/4a705a0bfb048c586682482f62379d15cdaecbf2) Thanks [@TomTomB](https://github.com/TomTomB)! - Add form clone util and animated if directive

### Patch Changes

- [`116b3802`](https://github.com/ethlete-io/ethdk/commit/116b380246675ad2c9ad105b76a3a0fcd6260e99) Thanks [@TomTomB](https://github.com/TomTomB)! - Monitor page size in smart scroll block and only block once its scrollable

## 3.4.0

### Minor Changes

- [`4c6bd7fc`](https://github.com/ethlete-io/ethdk/commit/4c6bd7fc34f6d283ddd7b329e39337e0126ed5e2) Thanks [@TomTomB](https://github.com/TomTomB)! - Add additional cookie util config options

## 3.3.1

### Patch Changes

- [`27080405`](https://github.com/ethlete-io/ethdk/commit/27080405555d9153044945a32a21238b93748ae5) Thanks [@TomTomB](https://github.com/TomTomB)! - Remove undefined from typed query list

## 3.3.0

### Minor Changes

- [`80cf4767`](https://github.com/ethlete-io/ethdk/commit/80cf476749f5ca457ac2d7e9ac033e2c724f87c1) Thanks [@TomTomB](https://github.com/TomTomB)! - Add key press manager util

## 3.2.0

### Minor Changes

- [`249e72a9`](https://github.com/ethlete-io/ethdk/commit/249e72a9ce447863ab3552fcb0d550c2e8bc6bd4) Thanks [@TomTomB](https://github.com/TomTomB)! - Allow using functions instead of property paths for selection model bindings

### Patch Changes

- [`a5f3f7b6`](https://github.com/ethlete-io/ethdk/commit/a5f3f7b64ab5d2689c4673f443ddcfd362937148) Thanks [@TomTomB](https://github.com/TomTomB)! - Move some combobox logic into core

## 3.1.0

### Minor Changes

- [#861](https://github.com/ethlete-io/ethdk/pull/861) [`0ba88b49`](https://github.com/ethlete-io/ethdk/commit/0ba88b49f2ffff30d4c70d95a3bd2f766ee7ef25) Thanks [@Gw3i](https://github.com/Gw3i)! - Add validateAtLeastOneRequired validator to validate keys of form controls in a supplied form group where at least one need to be selected

## 3.0.1

### Patch Changes

- [`f382cecd`](https://github.com/ethlete-io/ethdk/commit/f382cecd6eaf4dab1730c45bbf52ee385fd72880) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix typings in must match validator

## 3.0.0

### Major Changes

- [`93405c62`](https://github.com/ethlete-io/ethdk/commit/93405c623ca06bd395776624d5e9f9c03fcbba4b) Thanks [@TomTomB](https://github.com/TomTomB)! - Switch from popperjs to floating ui

  ```
  npm uninstall @popperjs/core
  npm install @floating-ui/dom
  ```

  Update attribute names in css styles

  ```css
  /* before */
  [data-popper-placement^='top'] {
  }

  /* after */
  [et-floating-placement^='top'] {
  }
  ```

## 2.9.0

### Minor Changes

- [`27b08e8d`](https://github.com/ethlete-io/ethdk/commit/27b08e8d9a399c255194463b60ec228bd09084b4) Thanks [@TomTomB](https://github.com/TomTomB)! - Remove subject utils

## 2.8.1

### Patch Changes

- [`2075620`](https://github.com/ethlete-io/ethdk/commit/207562029beaaa6486f1704f87a595ff2843bdb2) Thanks [@TomTomB](https://github.com/TomTomB)! - Dont emit wrong viewport values

## 2.8.0

### Minor Changes

- [`83f669a`](https://github.com/ethlete-io/ethdk/commit/83f669aca4fff6a05491a3cefb4031eafa34b65e) Thanks [@TomTomB](https://github.com/TomTomB)! - Add createMutationObservable util

### Patch Changes

- [`729054e`](https://github.com/ethlete-io/ethdk/commit/729054e40a9ad8b6a8623e3cf90c9c07e8be59d8) Thanks [@TomTomB](https://github.com/TomTomB)! - Minor scrollable fixes

- [`761c829`](https://github.com/ethlete-io/ethdk/commit/761c829811223998e8ac48338bd47241e7466e14) Thanks [@TomTomB](https://github.com/TomTomB)! - Allow for ip as hostname for cookies

## 2.7.4

### Patch Changes

- [`55af23e`](https://github.com/ethlete-io/ethdk/commit/55af23e37f477f5321b606a94cecf91d9073aa01) Thanks [@TomTomB](https://github.com/TomTomB)! - Improve perf of viewport monitor

## 2.7.3

### Patch Changes

- [`cbd9385`](https://github.com/ethlete-io/ethdk/commit/cbd93850ada03effdfb7e2954fbb0338856b3267) Thanks [@TomTomB](https://github.com/TomTomB)! - Prevent events after cursor dragging completed

## 2.7.2

### Patch Changes

- [`f972a3d`](https://github.com/ethlete-io/ethdk/commit/f972a3dcd3dc202ca572c655fa9536ea8ed6f77c) Thanks [@TomTomB](https://github.com/TomTomB)! - Minor scrolling and scrollable fixups

## 2.7.1

### Patch Changes

- [`f8df5b6`](https://github.com/ethlete-io/ethdk/commit/f8df5b66eea7c2cbf9e0143ecac0972f13c0befb) Thanks [@TomTomB](https://github.com/TomTomB)! - Dont wait for the next frame inside reactive bindings if eager option is set to true to avoid flickering

## 2.7.0

### Minor Changes

- [`cbfaaec`](https://github.com/ethlete-io/ethdk/commit/cbfaaece5879ce19578446c8462ad28c4814605d) Thanks [@TomTomB](https://github.com/TomTomB)! - Add getElementVisibleStates scroll util

## 2.6.1

### Patch Changes

- [`495e422`](https://github.com/ethlete-io/ethdk/commit/495e422baed0ed5fcfdfa3662545c75b67bbff8a) Thanks [@TomTomB](https://github.com/TomTomB)! - Add option for cursor drag scroll to only allow for specific directions

## 2.6.0

### Minor Changes

- [`ae600ae`](https://github.com/ethlete-io/ethdk/commit/ae600aeb3726d11c433e7f48677471db34b0e3ca) Thanks [@TomTomB](https://github.com/TomTomB)! - Add isElement helper directive

## 2.5.1

### Patch Changes

- [`e353a84`](https://github.com/ethlete-io/ethdk/commit/e353a841abac16b8eb75a94d287f91ea41041412) Thanks [@TomTomB](https://github.com/TomTomB)! - Wait for next frame inside reactive bindings before changing them on the html element

## 2.5.0

### Minor Changes

- [`84eabbe`](https://github.com/ethlete-io/ethdk/commit/84eabbe126fd418f75f4577c13ff3200f787b31a) Thanks [@TomTomB](https://github.com/TomTomB)! - Add active selection model util

## 2.4.3

### Patch Changes

- [`8d826df`](https://github.com/ethlete-io/ethdk/commit/8d826df4882bbfdf32aa6ee7ba985289bfb66c5f) Thanks [@TomTomB](https://github.com/TomTomB)! - Add aditional checks to prevent overlays from getting stuck during animation

## 2.4.2

### Patch Changes

- [`9ac46dc`](https://github.com/ethlete-io/ethdk/commit/9ac46dcc5e0f48e862ce5289c054c4f99eb4a3e6) Thanks [@TomTomB](https://github.com/TomTomB)! - Add option for allowed auto placements inside animated overlay

## 2.4.1

### Patch Changes

- [`cb4c725`](https://github.com/ethlete-io/ethdk/commit/cb4c725802dde5301006aa68662d1b934109dd4c) Thanks [@TomTomB](https://github.com/TomTomB)! - Add docs for router state service methods

## 2.4.0

### Minor Changes

- [`dc03f1a`](https://github.com/ethlete-io/ethdk/commit/dc03f1ae29f411c40d5194be83c907864aa2b01a) Thanks [@TomTomB](https://github.com/TomTomB)! - Add missing sync getter for route inside RouterStateService

- [`6f32c36`](https://github.com/ethlete-io/ethdk/commit/6f32c36a273bbfd7b87fe16937947b806746c61a) Thanks [@TomTomB](https://github.com/TomTomB)! - Add monitorViewport method to ViewportService for monitoring viewport and scrollbar sizes

### Patch Changes

- [`7376a9c`](https://github.com/ethlete-io/ethdk/commit/7376a9ca8db516ba4fb532990b264858a74797be) Thanks [@TomTomB](https://github.com/TomTomB)! - Use elementRef if etAnimateable input is an empty string

## 2.3.0

### Minor Changes

- [`4ed2d76`](https://github.com/ethlete-io/ethdk/commit/4ed2d765881843143af8fde26d97fca095cb3ed5) Thanks [@TomTomB](https://github.com/TomTomB)! - Add selection model and runtime error utils

## 2.2.1

### Patch Changes

- [`e917beb`](https://github.com/ethlete-io/ethdk/commit/e917beb55fde0585906e1c32755b969f6427030f) Thanks [@TomTomB](https://github.com/TomTomB)! - Keep track of mounted status inside animated overlay directive

## 2.2.0

### Minor Changes

- [`901b4e4`](https://github.com/ethlete-io/ethdk/commit/901b4e49afd87eec5574686fc7e5606cae5c7f87) Thanks [@TomTomB](https://github.com/TomTomB)! - Add additional observables to RouterStateService

## 2.1.0

### Minor Changes

- [`6f2f3e5`](https://github.com/ethlete-io/ethdk/commit/6f2f3e5962f225b1d3b2aed6170222c5431cec93) Thanks [@TomTomB](https://github.com/TomTomB)! - Add IsActiveElementDirective

## 2.0.0

### Major Changes

- [`6f30804`](https://github.com/ethlete-io/ethdk/commit/6f308042b9912d0a4b9ebd71e79afb5ab5269194) Thanks [@TomTomB](https://github.com/TomTomB)! - Remove `DestroyService` in favor of `createDestroy()` method. `createDestroy()` can only be used from within an injection context and will assert otherwise.

  Before:

  ```ts
  import { DestroyService } from '@ethlete/core';

  @Component({
    selector: 'my-component',
    template: `...`,
    providers: [DestroyService],
  })
  export class MyComponent {
    private readonly _destroy$ = inject(DestroyService).destroy$;
  }
  ```

  After:

  ```ts
  import { createDestroy } from '@ethlete/core';

  @Component({
    selector: 'my-component',
    template: `...`,
  })
  export class MyComponent {
    private readonly _destroy$ = createDestroy();
  }
  ```

### Minor Changes

- [`8897054`](https://github.com/ethlete-io/ethdk/commit/88970546ffd9b98071767892833a7509532627db) Thanks [@TomTomB](https://github.com/TomTomB)! - Add AnimatedOverlay directive

## 1.10.1

### Patch Changes

- [`04e0db6`](https://github.com/ethlete-io/ethdk/commit/04e0db6c0007d58705f88605f3f8ed2d0ad05ce3) Thanks [@TomTomB](https://github.com/TomTomB)! - Update to Angular 16

## 1.10.0

### Minor Changes

- [`a69bb1d`](https://github.com/ethlete-io/ethdk/commit/a69bb1d9a40891968c12b45031b4a73dc77ab205) Thanks [@TomTomB](https://github.com/TomTomB)! - Add host directive type def

## 1.9.1

### Patch Changes

- [`258b391`](https://github.com/ethlete-io/ethdk/commit/258b391370d69e2e496ec0ddd8b13d4eb5ede36a) Thanks [@TomTomB](https://github.com/TomTomB)! - Ignore delayable updates if the values doesnt change

## 1.9.0

### Minor Changes

- [`902ce1a`](https://github.com/ethlete-io/ethdk/commit/902ce1a60322e011e7b5e1c01d5875f68266f334) Thanks [@TomTomB](https://github.com/TomTomB)! - Add DelayableDirective

## 1.8.2

### Patch Changes

- [`dad4625`](https://github.com/ethlete-io/ethdk/commit/dad4625e17756ecf3321c016d9f9d0501303e1e0) Thanks [@TomTomB](https://github.com/TomTomB)! - Use distinctUntilChanged() inside router state observables

## 1.8.1

### Patch Changes

- [`717949c`](https://github.com/ethlete-io/ethdk/commit/717949cc020e248561213502aaea001b187b8c68) Thanks [@TomTomB](https://github.com/TomTomB)! - Allow for more than 4 chars after the last dot in an email adress

## 1.8.0

### Minor Changes

- [`400405d`](https://github.com/ethlete-io/ethdk/commit/400405dfded6a2b64ff69ce6a4b745c306ea5da2) Thanks [@TomTomB](https://github.com/TomTomB)! - Add option to supply a origin element to createFlipAnimation

## 1.7.0

### Minor Changes

- [#534](https://github.com/ethlete-io/ethdk/pull/534) [`03211cb`](https://github.com/ethlete-io/ethdk/commit/03211cb9915e6ab796649d19309fb1bbc631e09b) Thanks [@Marc-BrauneDigital](https://github.com/Marc-BrauneDigital)! - Add option to add inline/block-scroll-margin to scrollToElement

## 1.6.0

### Minor Changes

- [`686f3cb`](https://github.com/ethlete-io/ethdk/commit/686f3cb7d9cd7a924da499dea1054beba9dbd10f) Thanks [@TomTomB](https://github.com/TomTomB)! - Expose scrolling utils `scrollToElement` and `isElementVisible`

## 1.5.1

### Patch Changes

- [`4cf410b`](https://github.com/ethlete-io/ethdk/commit/4cf410bcd336a74fbd79e36b17d870f1a1a9e56e) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix viewport service share replay having a buffer size of infinity

## 1.5.0

### Minor Changes

- [`dce8411`](https://github.com/ethlete-io/ethdk/commit/dce8411e198e4e8b4dec37781b5f7cfbea9c4be6) Thanks [@TomTomB](https://github.com/TomTomB)! - Add smart block scroll stategy

## 1.4.3

### Patch Changes

- [`a37d5b8`](https://github.com/ethlete-io/ethdk/commit/a37d5b8f713d57c23ba857d31b2c59601efeebb6) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix endless loop when scrollable content changes a lot

## 1.4.2

### Patch Changes

- [`d460577`](https://github.com/ethlete-io/ethdk/commit/d4605771f787d0505c83c2ad945b1d12ce7f3502) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix scroll observer having issues with decimals

## 1.4.1

### Patch Changes

- [`f092450`](https://github.com/ethlete-io/ethdk/commit/f092450e661121dde9c3a7a56d53edd982a20136) Thanks [@TomTomB](https://github.com/TomTomB)! - Mark DestroyService as deprecated

## 1.4.0

### Minor Changes

- [`033c740`](https://github.com/ethlete-io/ethdk/commit/033c740e78a561fdf9652dc0b0e6fc84abe36dc8) Thanks [@TomTomB](https://github.com/TomTomB)! - Add util to create a behavior subject that exposes a subscriber count

## 1.3.0

### Minor Changes

- [`6006f19`](https://github.com/ethlete-io/ethdk/commit/6006f199078516109749437611a9356d7897ef7f) Thanks [@TomTomB](https://github.com/TomTomB)! - Add create flip animation group util

## 1.2.0

### Minor Changes

- [#487](https://github.com/ethlete-io/ethdk/pull/487) [`b5180bd`](https://github.com/ethlete-io/ethdk/commit/b5180bd849f458b3efc640616db6bbd0b408fbd2) Thanks [@TomTomB](https://github.com/TomTomB)! - Add flip animation builder

## 1.1.1

### Patch Changes

- [`b2f75c2`](https://github.com/ethlete-io/ethdk/commit/b2f75c27422b6eec2956a1780a34b21253bb4561) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix dialog and bottom sheet getting stuck in an open position

## 1.1.0

### Minor Changes

- [#480](https://github.com/ethlete-io/ethdk/pull/480) [`920e5f2`](https://github.com/ethlete-io/ethdk/commit/920e5f2f77cd46cb9af42abccd3b66f08cf40896) Thanks [@TomTomB](https://github.com/TomTomB)! - Allow passing element or selector to animatable directive

## 1.0.0

### Major Changes

- [#475](https://github.com/ethlete-io/ethdk/pull/475) [`44ac6e6`](https://github.com/ethlete-io/ethdk/commit/44ac6e621c9b2c2e02b45f7abc2c1b3111604d56) Thanks [@TomTomB](https://github.com/TomTomB)! - Initial stable release

### Minor Changes

- [#460](https://github.com/ethlete-io/ethdk/pull/460) [`220baf3`](https://github.com/ethlete-io/ethdk/commit/220baf35ae75fe46e7e5b9b9fa089ee6da824070) Thanks [@nziermann](https://github.com/nziermann)! - Add createMediaQueryObservable util

- [#455](https://github.com/ethlete-io/ethdk/pull/455) [`820a761`](https://github.com/ethlete-io/ethdk/commit/820a761d923982d3bb25fe9d5b0f89e8bfdb9e96) Thanks [@nziermann](https://github.com/nziermann)! - Add more options to router state enableScrollEnhancements fn

- [#446](https://github.com/ethlete-io/ethdk/pull/446) [`f8a8d5c`](https://github.com/ethlete-io/ethdk/commit/f8a8d5c9c4750b979f73fb866aa15d65d3c5971a) Thanks [@nziermann](https://github.com/nziermann)! - Add router state service

- [#475](https://github.com/ethlete-io/ethdk/pull/475) [`e1e2f74`](https://github.com/ethlete-io/ethdk/commit/e1e2f7405641a47cd608f375f1174d367538da89) Thanks [@TomTomB](https://github.com/TomTomB)! - Add normalize game result type pipe

- [#475](https://github.com/ethlete-io/ethdk/pull/475) [`834dab4`](https://github.com/ethlete-io/ethdk/commit/834dab4317f6bafd7919263c56bd6638a0a9ad09) Thanks [@TomTomB](https://github.com/TomTomB)! - Remove destroy directive in favor of destroy service

- [#475](https://github.com/ethlete-io/ethdk/pull/475) [`210e892`](https://github.com/ethlete-io/ethdk/commit/210e892bcb20003f7d3d3535a65aaa2ac9d41602) Thanks [@TomTomB](https://github.com/TomTomB)! - - Feat: Add `currentViewport# @ethlete/core and `currentViewport` to get the current viewport string to the viewport service
  - Feat: Add resize & content observer directives & services
  - Fix: Append less decimals to breakpoints created by the viewport service
  - Fix: Use all available args to create a cache id by the @Memo default resolver

- [#475](https://github.com/ethlete-io/ethdk/pull/475) [`24ded48`](https://github.com/ethlete-io/ethdk/commit/24ded48c0bf6ce2239f2a831dda2d3c3b9a74a37) Thanks [@TomTomB](https://github.com/TomTomB)! - Add animated lifecycle directive

- [#418](https://github.com/ethlete-io/ethdk/pull/418) [`e55f055`](https://github.com/ethlete-io/ethdk/commit/e55f055306dbeac226cb9d3e989d3bca2804bd3f) Thanks [@nziermann](https://github.com/nziermann)! - Add some missing methods to typed query list

- [#475](https://github.com/ethlete-io/ethdk/pull/475) [`c8c5ac8`](https://github.com/ethlete-io/ethdk/commit/c8c5ac80b4dd71c628776aa6aaaef67d9eda8b51) Thanks [@TomTomB](https://github.com/TomTomB)! - Add animateable directive

- [#475](https://github.com/ethlete-io/ethdk/pull/475) [`b3577c6`](https://github.com/ethlete-io/ethdk/commit/b3577c65bacf9a9b27a967fa9fe44d29d6531cf8) Thanks [@TomTomB](https://github.com/TomTomB)! - Add seo directive

- [#418](https://github.com/ethlete-io/ethdk/pull/418) [`9ea8477`](https://github.com/ethlete-io/ethdk/commit/9ea847781fb53dc6cb2c00c7f4be15a0244534fb) Thanks [@nziermann](https://github.com/nziermann)! - Add structured data component

- [#418](https://github.com/ethlete-io/ethdk/pull/418) [`429709e`](https://github.com/ethlete-io/ethdk/commit/429709ef74d4728e2b7019a0bb7dd0dd94ff2c79) Thanks [@nziermann](https://github.com/nziermann)! - Allow customizing the element ref for reactive bindings

- [#475](https://github.com/ethlete-io/ethdk/pull/475) [`2ffd101`](https://github.com/ethlete-io/ethdk/commit/2ffd1014a15812d31c07f0e55c12b34727f03d9a) Thanks [@TomTomB](https://github.com/TomTomB)! - Add click observer service

- [#49](https://github.com/ethlete-io/ethdk/pull/49) [`5c95058`](https://github.com/ethlete-io/ethdk/commit/5c9505837ee3e5f2457169591acd01c79eade565) Thanks [@TomTomB](https://github.com/TomTomB)! - - Add memo decorator
  - Add let & repeat directives
  - Add toArray pipe
  - Add focus visible service
  - Add clamp utils

- [#469](https://github.com/ethlete-io/ethdk/pull/469) [`33bec45`](https://github.com/ethlete-io/ethdk/commit/33bec45637946013c6a647701a58e678734fd6fd) Thanks [@nziermann](https://github.com/nziermann)! - Add common form validators

- [#418](https://github.com/ethlete-io/ethdk/pull/418) [`0c07f13`](https://github.com/ethlete-io/ethdk/commit/0c07f13d36fe4d79f63d0cbb72c77b94379ed2d6) Thanks [@nziermann](https://github.com/nziermann)! - Support classes in reactive bindings

- [#418](https://github.com/ethlete-io/ethdk/pull/418) [`756141c`](https://github.com/ethlete-io/ethdk/commit/756141c6b1eb78f1adc170d90cdcf9f2910e9ba3) Thanks [@nziermann](https://github.com/nziermann)! - Add cookie utils

- [#475](https://github.com/ethlete-io/ethdk/pull/475) [`42da540`](https://github.com/ethlete-io/ethdk/commit/42da54003a3b1c7a313b888a97938692e8e43370) Thanks [@TomTomB](https://github.com/TomTomB)! - Add normalize match participants pipe

- [#418](https://github.com/ethlete-io/ethdk/pull/418) [`72e0911`](https://github.com/ethlete-io/ethdk/commit/72e0911cac1784f112270e78bc1f2b6a4ffff6cc) Thanks [@nziermann](https://github.com/nziermann)! - Add reactive binding util

### Patch Changes

- [#455](https://github.com/ethlete-io/ethdk/pull/455) [`ab20501`](https://github.com/ethlete-io/ethdk/commit/ab2050107a217647cc03c0ba96cf7151896d7f7f) Thanks [@nziermann](https://github.com/nziermann)! - Rename observe directive change events

- [#475](https://github.com/ethlete-io/ethdk/pull/475) [`38042f4`](https://github.com/ethlete-io/ethdk/commit/38042f40b4db21ac617aaa841a5869b285baf4a4) Thanks [@TomTomB](https://github.com/TomTomB)! - Replace destroy service with destroy directive since providedIn any is deprecated

- [#475](https://github.com/ethlete-io/ethdk/pull/475) [`b7e087c`](https://github.com/ethlete-io/ethdk/commit/b7e087c096aea289fdc81806839ea7dede72e5db) Thanks [@TomTomB](https://github.com/TomTomB)! - Add NgClassType type def

- [#475](https://github.com/ethlete-io/ethdk/pull/475) [`90612d8`](https://github.com/ethlete-io/ethdk/commit/90612d8083a41e2fb64db893791ab1f576d564c6) Thanks [@TomTomB](https://github.com/TomTomB)! - Bring back DestoryService to pevent error NG0309

- [#475](https://github.com/ethlete-io/ethdk/pull/475) [`222d87b`](https://github.com/ethlete-io/ethdk/commit/222d87b67186d7d97e4d2a8a4d5a611d79a05e43) Thanks [@TomTomB](https://github.com/TomTomB)! - Add option to enable and disable cursor drag scroll directive

- [#475](https://github.com/ethlete-io/ethdk/pull/475) [`1816e3e`](https://github.com/ethlete-io/ethdk/commit/1816e3e9bd7d2a3c8505a8b5050026d7f23ff75a) Thanks [@TomTomB](https://github.com/TomTomB)! - Move directives and utils into core from components

- [#475](https://github.com/ethlete-io/ethdk/pull/475) [`dcca3cb`](https://github.com/ethlete-io/ethdk/commit/dcca3cb38bd00bab40ec3f3880500ef3bd449f72) Thanks [@TomTomB](https://github.com/TomTomB)! - Fixup minior issues in animated lifecycle directive

- [#433](https://github.com/ethlete-io/ethdk/pull/433) [`e385e30`](https://github.com/ethlete-io/ethdk/commit/e385e304974cf562804ae358092fc47475509f21) Thanks [@nziermann](https://github.com/nziermann)! - Fix clone returning undefined if value to clone is not an object

- [#418](https://github.com/ethlete-io/ethdk/pull/418) [`b5086c0`](https://github.com/ethlete-io/ethdk/commit/b5086c05df81588791ac5bc5a6497691e51dab5d) Thanks [@nziermann](https://github.com/nziermann)! - Add missing type def for TypedQueryList.find

- [#475](https://github.com/ethlete-io/ethdk/pull/475) [`4dad6d6`](https://github.com/ethlete-io/ethdk/commit/4dad6d643f3d5bf5bb7b322781dc4871cef5d956) Thanks [@TomTomB](https://github.com/TomTomB)! - Add scrollable directives to set a custom first and last element

- [#475](https://github.com/ethlete-io/ethdk/pull/475) [`4dad6d6`](https://github.com/ethlete-io/ethdk/commit/4dad6d643f3d5bf5bb7b322781dc4871cef5d956) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix scrollable scroll state not getting checked correctly on screen resize

- [#475](https://github.com/ethlete-io/ethdk/pull/475) [`50dc199`](https://github.com/ethlete-io/ethdk/commit/50dc199faad225c49350c6595f4664cedb51bc6f) Thanks [@TomTomB](https://github.com/TomTomB)! - Update view if repeat directive input changes

- [#475](https://github.com/ethlete-io/ethdk/pull/475) [`83e3c88`](https://github.com/ethlete-io/ethdk/commit/83e3c88011f1808e9f019c2aa6bc5a4b7449e73c) Thanks [@TomTomB](https://github.com/TomTomB)! - Missing release for scroll observer fixes

- [#475](https://github.com/ethlete-io/ethdk/pull/475) [`1327af1`](https://github.com/ethlete-io/ethdk/commit/1327af13c721f8fe26d53bd12abd17e93d62bee5) Thanks [@TomTomB](https://github.com/TomTomB)! - Dependency updates

- [#418](https://github.com/ethlete-io/ethdk/pull/418) [`0ce1f51`](https://github.com/ethlete-io/ethdk/commit/0ce1f51b0ffe8b69f2774d283bab8fa3b3d10c91) Thanks [@nziermann](https://github.com/nziermann)! - Use faster versions of cloning and comparing objects

- [#475](https://github.com/ethlete-io/ethdk/pull/475) [`b5c4ec9`](https://github.com/ethlete-io/ethdk/commit/b5c4ec9bff52f255b8bf14f17c589c9fa696f265) Thanks [@TomTomB](https://github.com/TomTomB)! - Add classes to current scroll observed elements

- [#475](https://github.com/ethlete-io/ethdk/pull/475) [`9ab3ac6`](https://github.com/ethlete-io/ethdk/commit/9ab3ac6e84dbd8ac08abb8ab23c612c93bfc8f72) Thanks [@TomTomB](https://github.com/TomTomB)! - Make ObserveContentDirective standalone

- [#418](https://github.com/ethlete-io/ethdk/pull/418) [`bb74015`](https://github.com/ethlete-io/ethdk/commit/bb740155333084777c57ca4082b0a7d504c1b4ae) Thanks [@nziermann](https://github.com/nziermann)! - Fix typedefs for TypedQueryList

- [#418](https://github.com/ethlete-io/ethdk/pull/418) [`2be3d4b`](https://github.com/ethlete-io/ethdk/commit/2be3d4b3307995385cde6326057d14eb08b67072) Thanks [@nziermann](https://github.com/nziermann)! - Skip reactive bildings where values are invalid

## 0.2.0-next.25

### Minor Changes

- [`24ded48`](https://github.com/ethlete-io/ethdk/commit/24ded48c0bf6ce2239f2a831dda2d3c3b9a74a37) Thanks [@TomTomB](https://github.com/TomTomB)! - Add animated lifecycle directive

- [`c8c5ac8`](https://github.com/ethlete-io/ethdk/commit/c8c5ac80b4dd71c628776aa6aaaef67d9eda8b51) Thanks [@TomTomB](https://github.com/TomTomB)! - Add animateable directive

## 0.2.0-next.24

### Minor Changes

- [`33bec45`](https://github.com/ethlete-io/ethdk/commit/33bec45637946013c6a647701a58e678734fd6fd) Thanks [@TomTomB](https://github.com/TomTomB)! - Add common form validators

## 0.2.0-next.23

### Minor Changes

- [`220baf3`](https://github.com/ethlete-io/ethdk/commit/220baf35ae75fe46e7e5b9b9fa089ee6da824070) Thanks [@TomTomB](https://github.com/TomTomB)! - Add createMediaQueryObservable util

## 0.2.0-next.22

### Patch Changes

- [#455](https://github.com/ethlete-io/ethdk/pull/455) [`ab20501`](https://github.com/ethlete-io/ethdk/commit/ab2050107a217647cc03c0ba96cf7151896d7f7f) Thanks [@nziermann](https://github.com/nziermann)! - Rename observe directive change events

## 0.2.0-next.21

### Minor Changes

- [`820a761`](https://github.com/ethlete-io/ethdk/commit/820a761d923982d3bb25fe9d5b0f89e8bfdb9e96) Thanks [@TomTomB](https://github.com/TomTomB)! - Add more options to router state enableScrollEnhancements fn

## 0.2.0-next.20

### Minor Changes

- [`f8a8d5c`](https://github.com/ethlete-io/ethdk/commit/f8a8d5c9c4750b979f73fb866aa15d65d3c5971a) Thanks [@TomTomB](https://github.com/TomTomB)! - Add router state service

## 0.2.0-next.19

### Patch Changes

- [`e385e30`](https://github.com/ethlete-io/ethdk/commit/e385e304974cf562804ae358092fc47475509f21) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix clone returning undefined if value to clone is not an object

## 0.2.0-next.18

### Patch Changes

- [`0ce1f51`](https://github.com/ethlete-io/ethdk/commit/0ce1f51b0ffe8b69f2774d283bab8fa3b3d10c91) Thanks [@TomTomB](https://github.com/TomTomB)! - Use faster versions of cloning and comparing objects

## 0.2.0-next.17

### Patch Changes

- [`b5086c0`](https://github.com/ethlete-io/ethdk/commit/b5086c05df81588791ac5bc5a6497691e51dab5d) Thanks [@TomTomB](https://github.com/TomTomB)! - Add missing type def for TypedQueryList.find

## 0.2.0-next.16

### Minor Changes

- [`756141c`](https://github.com/ethlete-io/ethdk/commit/756141c6b1eb78f1adc170d90cdcf9f2910e9ba3) Thanks [@TomTomB](https://github.com/TomTomB)! - Add cookie utils

## 0.2.0-next.15

### Minor Changes

- [#309](https://github.com/ethlete-io/ethdk/pull/309) [`e55f055`](https://github.com/ethlete-io/ethdk/commit/e55f055306dbeac226cb9d3e989d3bca2804bd3f) Thanks [@renovate](https://github.com/apps/renovate)! - Add some missing methods to typed query list

## 0.2.0-next.14

### Patch Changes

- [`2be3d4b`](https://github.com/ethlete-io/ethdk/commit/2be3d4b3307995385cde6326057d14eb08b67072) Thanks [@TomTomB](https://github.com/TomTomB)! - Skip reactive bildings where values are invalid

## 0.2.0-next.13

### Patch Changes

- [`bb74015`](https://github.com/ethlete-io/ethdk/commit/bb740155333084777c57ca4082b0a7d504c1b4ae) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix typedefs for TypedQueryList

## 0.2.0-next.12

### Minor Changes

- [#303](https://github.com/ethlete-io/ethdk/pull/303) [`429709e`](https://github.com/ethlete-io/ethdk/commit/429709ef74d4728e2b7019a0bb7dd0dd94ff2c79) Thanks [@renovate](https://github.com/apps/renovate)! - Allow customizing the element ref for reactive bindings

- [#303](https://github.com/ethlete-io/ethdk/pull/303) [`0c07f13`](https://github.com/ethlete-io/ethdk/commit/0c07f13d36fe4d79f63d0cbb72c77b94379ed2d6) Thanks [@renovate](https://github.com/apps/renovate)! - Support classes in reactive bindings

## 0.2.0-next.11

### Minor Changes

- [#303](https://github.com/ethlete-io/ethdk/pull/303) [`9ea8477`](https://github.com/ethlete-io/ethdk/commit/9ea847781fb53dc6cb2c00c7f4be15a0244534fb) Thanks [@renovate](https://github.com/apps/renovate)! - Add structured data component

- [#303](https://github.com/ethlete-io/ethdk/pull/303) [`72e0911`](https://github.com/ethlete-io/ethdk/commit/72e0911cac1784f112270e78bc1f2b6a4ffff6cc) Thanks [@renovate](https://github.com/apps/renovate)! - Add reactive binding util

## 0.2.0-next.10

### Minor Changes

- [#193](https://github.com/ethlete-io/ethdk/pull/193) [`834dab4`](https://github.com/ethlete-io/ethdk/commit/834dab4317f6bafd7919263c56bd6638a0a9ad09) Thanks [@renovate](https://github.com/apps/renovate)! - Remove destroy directive in favor of destroy service

### Patch Changes

- [#193](https://github.com/ethlete-io/ethdk/pull/193) [`50dc199`](https://github.com/ethlete-io/ethdk/commit/50dc199faad225c49350c6595f4664cedb51bc6f) Thanks [@renovate](https://github.com/apps/renovate)! - Update view if repeat directive input changes

- [`1327af1`](https://github.com/ethlete-io/ethdk/commit/1327af13c721f8fe26d53bd12abd17e93d62bee5) Thanks [@TomTomB](https://github.com/TomTomB)! - Dependency updates

## 0.2.0-next.9

### Minor Changes

- [#167](https://github.com/ethlete-io/ethdk/pull/167) [`e1e2f74`](https://github.com/ethlete-io/ethdk/commit/e1e2f7405641a47cd608f375f1174d367538da89) Thanks [@renovate](https://github.com/apps/renovate)! - Add normalize game result type pipe

- [#167](https://github.com/ethlete-io/ethdk/pull/167) [`42da540`](https://github.com/ethlete-io/ethdk/commit/42da54003a3b1c7a313b888a97938692e8e43370) Thanks [@renovate](https://github.com/apps/renovate)! - Add normalize match participants pipe

## 0.2.0-next.8

### Minor Changes

- [`b3577c6`](https://github.com/ethlete-io/ethdk/commit/b3577c65bacf9a9b27a967fa9fe44d29d6531cf8) Thanks [@TomTomB](https://github.com/TomTomB)! - Add seo directive

## 0.2.0-next.7

### Patch Changes

- [#193](https://github.com/ethlete-io/ethdk/pull/193) [`38042f4`](https://github.com/ethlete-io/ethdk/commit/38042f40b4db21ac617aaa841a5869b285baf4a4) Thanks [@renovate](https://github.com/apps/renovate)! - Replace destroy service with destroy directive since providedIn any is deprecated

- [#193](https://github.com/ethlete-io/ethdk/pull/193) [`90612d8`](https://github.com/ethlete-io/ethdk/commit/90612d8083a41e2fb64db893791ab1f576d564c6) Thanks [@renovate](https://github.com/apps/renovate)! - Bring back DestoryService to pevent error NG0309

- [#193](https://github.com/ethlete-io/ethdk/pull/193) [`222d87b`](https://github.com/ethlete-io/ethdk/commit/222d87b67186d7d97e4d2a8a4d5a611d79a05e43) Thanks [@renovate](https://github.com/apps/renovate)! - Add option to enable and disable cursor drag scroll directive

- [#193](https://github.com/ethlete-io/ethdk/pull/193) [`4dad6d6`](https://github.com/ethlete-io/ethdk/commit/4dad6d643f3d5bf5bb7b322781dc4871cef5d956) Thanks [@renovate](https://github.com/apps/renovate)! - Add scrollable directives to set a custom first and last element

- [#193](https://github.com/ethlete-io/ethdk/pull/193) [`4dad6d6`](https://github.com/ethlete-io/ethdk/commit/4dad6d643f3d5bf5bb7b322781dc4871cef5d956) Thanks [@renovate](https://github.com/apps/renovate)! - Fix scrollable scroll state not getting checked correctly on screen resize

- [#193](https://github.com/ethlete-io/ethdk/pull/193) [`b5c4ec9`](https://github.com/ethlete-io/ethdk/commit/b5c4ec9bff52f255b8bf14f17c589c9fa696f265) Thanks [@renovate](https://github.com/apps/renovate)! - Add classes to current scroll observed elements

## 0.2.0-next.6

### Patch Changes

- [`83e3c88`](https://github.com/ethlete-io/ethdk/commit/83e3c88011f1808e9f019c2aa6bc5a4b7449e73c) Thanks [@TomTomB](https://github.com/TomTomB)! - Missing release for scroll observer fixes

## 0.2.0-next.5

### Patch Changes

- [`1816e3e`](https://github.com/ethlete-io/ethdk/commit/1816e3e9bd7d2a3c8505a8b5050026d7f23ff75a) Thanks [@TomTomB](https://github.com/TomTomB)! - Move directives and utils into core from components

## 0.2.0-next.4

### Minor Changes

- [`2ffd101`](https://github.com/ethlete-io/ethdk/commit/2ffd1014a15812d31c07f0e55c12b34727f03d9a) Thanks [@TomTomB](https://github.com/TomTomB)! - Add click observer service

## 0.2.0-next.3

### Patch Changes

- [`9ab3ac6`](https://github.com/ethlete-io/ethdk/commit/9ab3ac6e84dbd8ac08abb8ab23c612c93bfc8f72) Thanks [@TomTomB](https://github.com/TomTomB)! - Make ObserveContentDirective standalone

## 0.2.0-next.2

### Minor Changes

- [`210e892`](https://github.com/ethlete-io/ethdk/commit/210e892bcb20003f7d3d3535a65aaa2ac9d41602) Thanks [@TomTomB](https://github.com/TomTomB)! - - Feat: Add `currentViewport# @ethlete/core and `currentViewport` to get the current viewport string to the viewport service
  - Feat: Add resize & content observer directives & services
  - Fix: Append less decimals to breakpoints created by the viewport service
  - Fix: Use all available args to create a cache id by the @Memo default resolver

## 0.2.0-next.1

### Patch Changes

- [`b7e087c`](https://github.com/ethlete-io/ethdk/commit/b7e087c096aea289fdc81806839ea7dede72e5db) Thanks [@TomTomB](https://github.com/TomTomB)! - Add NgClassType type def

## 0.2.0-next.0

### Minor Changes

- [#49](https://github.com/ethlete-io/ethdk/pull/49) [`5c95058`](https://github.com/ethlete-io/ethdk/commit/5c9505837ee3e5f2457169591acd01c79eade565) Thanks [@TomTomB](https://github.com/TomTomB)! - - Add memo decorator
  - Add let & repeat directives
  - Add toArray pipe
  - Add focus visible service
  - Add clamp utils

## 0.1.0

### Minor Changes

- [#23](https://github.com/ethlete-io/ethdk/pull/23) [`cb4f96f`](https://github.com/ethlete-io/ethdk/commit/cb4f96f732c31ea6511ee5398d094474d8023244) Thanks [@TomTomB](https://github.com/TomTomB)! - Add viewport service
