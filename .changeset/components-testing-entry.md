---
'@ethlete/components': minor
---

Add the `@ethlete/components/testing` entry point for app specs. `setupComponentsTestEnvironment()` installs the `ResizeObserver`, `IntersectionObserver`, `matchMedia` and `Element.animate` fakes jsdom lacks.

The entry also exports `createTestOverlayRef` / `provideTestOverlayRef` to unit-test an overlay component without opening it, and the select, date picker, tab bar, field and overlay control drivers.
