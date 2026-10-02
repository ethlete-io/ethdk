# Testing

`@ethlete/components/testing` is the entry point for unit specs of an app that renders
`@ethlete/components`: the browser APIs jsdom lacks, an `OverlayRef` fake, and drivers that wrap a
mounted control in the clicks and keys a user produces. It imports `TestBed` from
`@angular/core/testing` and nothing from a test runner, so it works under Vitest and Jest alike.
Import it from specs only - never from application code.

```ts
import { createSelectDriver, setupComponentsTestEnvironment } from '@ethlete/components/testing';
```

## The jsdom environment

jsdom has no `ResizeObserver`, `IntersectionObserver`, `matchMedia` or `Element.animate`. A component
built on `et-scrollable` (tabs, carousel, nav tabs), an overlay or the animation utils fails without
them, with `ReferenceError: ResizeObserver is not defined` or `matchMedia is not a function`. Call
`setupComponentsTestEnvironment()` once, in the test setup file:

```ts
// src/test-setup.ts
import { setupComponentsTestEnvironment } from '@ethlete/components/testing';

setupComponentsTestEnvironment();
```

An API that already exists is left alone. The fakes never report: observers never fire, no media
query matches (so breakpoint-driven state stays at its "no match" default), and an animation
finishes on the next microtask, so code that waits for `finished` still runs its cleanup.

## Drivers

A driver takes a `ComponentFixture` whose host renders the control, and returns the control's
directive, scoped queries, and user actions. Mount the host with your own `TestBed` setup. Form
controls resolve their validation colours by theme `type`, so the testing module needs your app's
`provideColorThemes(...)` with an `error` and a `warning` theme.

```ts
import { createSelectDriver } from '@ethlete/components/testing';

it('picks a country', async () => {
  TestBed.configureTestingModule({ providers: [provideColorThemes(APP_COLOR_THEMES)] });
  const fixture = TestBed.createComponent(CountryFormComponent);
  fixture.detectChanges();

  const select = createSelectDriver(fixture, { directiveSelector: 'et-select' });

  await select.open();
  select.clickOptionByLabel('Germany');

  expect(select.valueText()).toBe('Germany');
});
```

| Driver                                                     | For                                                                          |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `createSelectDriver(fixture, options?)`                    | `et-select` / `[etSelect]`: open, options, chips, search, virtual scroll     |
| `createDatePickerDriver(fixture, directiveType, options?)` | Date, date range, date-time, time and time range inputs with their picker    |
| `createTabBarDriver(fixture, options?)`                    | `[etTabBar]`: triggers, the roving tab stop, arrow keys                      |
| `createFieldControlDriver(fixture, directiveType, opts?)`  | Any text-field control: type, type per character, focus, blur, keys          |
| `createOverlayControlDriver(fixture, directiveType, opts)` | Any overlay-backed control: trigger, pane queries, open/close                |
| `createControlDriver(fixture, directiveType, options?)`    | The base every driver spreads: host, directive, `query`, `queryAll`, `click` |

`options.directiveSelector` picks the element carrying the directive when the host template nests
it; without it the driver uses the host's first child.

The event helpers the drivers use are exported too: `pressKey`, `setInputValue`, `typeChars`,
`typeInField`, `focusField`, `blurField`, `pointerEvent`, `pointerEnter`, `pointerDownOutside`,
`pasteInto`, plus `tick` (one `ApplicationRef.tick()`), `flushFrames` (two animation frames) and
`latestPane`. Overlays render into `document.body`, not into the fixture, and jsdom fires no
transition events, so a pane in its leave transition stays in the DOM: query panes through
`latestPane()`, and call `resetOverlays()` between tests.

## Testing an overlay component

An overlay component reads its ref through `definition.injectRef()`, which throws
[ET1207](/components/error-codes) outside an open overlay. `provideTestOverlayRef()` provides a
standalone fake, so the component can be created directly with `TestBed`:

```ts
import { createTestOverlayRef, provideTestOverlayRef } from '@ethlete/components/testing';

it('closes with the saved product', () => {
  const ref = createTestOverlayRef<ProductResult>();

  TestBed.configureTestingModule({ providers: [provideTestOverlayRef(ref)] });
  const fixture = TestBed.createComponent(ProductOverlayComponent);
  fixture.detectChanges();

  fixture.nativeElement.querySelector('.save-button').click();

  expect(ref.closeCalls.at(-1)?.result).toEqual({ saved: true });
  expect(ref.isClosed()).toBe(true);
});
```

`close(result)` runs the registered close guards, so a veto shows up as a recorded call with
`isClosed()` still `false`; `forceClose()` skips them. `closeCalls` lists every call in order with its
`result`, `source` and `forced` flag. `afterClosed()` and `beforeClosed()` replay the result, so a
subscriber added after the close still gets it. `createTestOverlayRef(config)` takes an
`OverlayConfig` for a component that reads `ref.config`.

To test the code that _opens_ the overlay, render the real overlay instead: the opener needs no
fake, only the jsdom environment above.
