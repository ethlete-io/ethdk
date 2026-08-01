# Providers

App-level services following the SDK's provider-tuple pattern (see [Utilities → Dependency injection](/core/utilities#dependency-injection)): each ships a `provideX()` / `injectX()` pair. Almost all of them are **root-provided** — you can `injectX()` anywhere without touching your app config; calling `provideX()` is only needed to re-scope or override in a sub-injector.

```ts
import { injectBreakpointObserver } from '@ethlete/core';

@Component({/* … */})
export class ToolbarComponent {
  private breakpointObserver = injectBreakpointObserver();

  protected isDesktop = this.breakpointObserver.observeBreakpoint({ min: 'lg' });
}
```

## Breakpoint observer

`injectBreakpointObserver()` — signal-based media-query matching:

| Method                           | Returns           | Description                                            |
| -------------------------------- | ----------------- | ------------------------------------------------------ |
| `observeBreakpoint(options)`     | `Signal<boolean>` | Live match state for a min/max breakpoint range.       |
| `isBreakpointMatched(options)`   | `boolean`         | One-off check.                                         |
| `observeMediaQuery(query)`       | `Signal<boolean>` | Live match state for a raw media query string.         |
| `isMediaQueryMatched(query)`     | `boolean`         | One-off check for a raw query.                         |
| `buildMediaQueryString(options)` | `string`          | Builds the query without observing it.                 |
| `getBreakpointSize(name, side)`  | `number`          | Pixel value of a breakpoint's `'min'` or `'max'` side. |

Options take `{ min?, max? }` where each side is a breakpoint name or a raw pixel number. The breakpoints come from the viewport config — the default matches Tailwind:

| Breakpoint | Range       |
| ---------- | ----------- |
| `xs`       | 0 – 639     |
| `sm`       | 640 – 767   |
| `md`       | 768 – 1023  |
| `lg`       | 1024 – 1279 |
| `xl`       | 1280 – 1535 |
| `2xl`      | 1536 – ∞    |

Override them app-wide with `provideViewportConfig({ breakpoints: { … } })` (shallow-merged onto the default).

## Locale

`injectLocale()` returns `{ currentLocale: WritableSignal<string> }`, defaulting to `'en'`. Everything locale-aware reacts to it, so switching language at runtime needs no reload; update it with `injectLocale().currentLocale.set('de')`.

`defineLabels(name, defaults)` is the shape built on top of it, and the only mechanism the UI library uses for strings it renders itself. It returns a definition whose halves you name with `toProvideFn` / `toInjectFn` / `toToken` (see [Dependency injection](/core/utilities#dependency-injection) for why the split) — partial overrides in, a `Signal<Labels>` out, re-resolved whenever the locale changes. `defaults` may itself be a `(locale) => Labels` function for a domain that ships more than one language.

```ts
const WIDGET_LABELS_DEF = /* @__PURE__ */ defineLabels<WidgetLabels>('WIDGET_LABELS', DEFAULT_WIDGET_LABELS);

export const provideWidgetLabels = /* @__PURE__ */ toProvideFn(WIDGET_LABELS_DEF);
export const injectWidgetLabels = /* @__PURE__ */ toInjectFn(WIDGET_LABELS_DEF);
export const WIDGET_LABELS = /* @__PURE__ */ toToken(WIDGET_LABELS_DEF);
```

See the [localization guide](/components/localization) for the full recipe and every token the UI library exposes.

## Focus-visible tracker

`injectFocusVisibleTracker()` returns `{ isFocusVisible: Signal<boolean> }` — whether focus is currently keyboard-driven. It flips to `true` after keyboard navigation (Tab & friends) and back to `false` on pointer input. Used by tooltips to decide whether a focus event should open them.

## Renderer

`injectRenderer()` wraps Angular's `Renderer2` with ergonomic helpers — `toggleClass`, `setStyle`/`removeStyle` (removing on `null`), `setAttributes`, `setDataAttributes`, `setCssProperty` (dash-case, for custom properties), `setInnerHTML`, `moveBefore` (native with `insertBefore` fallback), and more — plus the raw `renderer`. Prefer it over touching `document` directly; it keeps DOM writes SSR-safe.

## Style manager

`injectStyleManager()` returns `{ mount(component) }` — mounts a style-only component once into a hidden container on `document.body` so its CSS is loaded globally without rendering UI. Mounting is idempotent per component type. This is how Ethlete components self-register their global styles.

## Boundary element

The one provider here that is **not** root-provided: `provideBoundaryElement()` must be provided by an ancestor before `injectBoundaryElement()` works. It exposes `{ value: Signal<HTMLElement>, override: WritableSignal<HTMLElement | null> }` — the element positioning/overflow logic should treat as its clipping boundary (`override` → the providing host element → `document.documentElement`). The overlay system provides one per overlay container.

## User consent

`createUserConsentProvider({ for, isGranted, grant, revoke? })` binds your app's consent source (e.g. a cookie banner service) to an injection token of your choosing, as a `ConsentHandler`:

```ts
const STREAM_CONSENT_DEF = /* @__PURE__ */ defineStaticProvider<ConsentHandler | null>(null);

export const provideStreamConsent = /* @__PURE__ */ toProvideFn(STREAM_CONSENT_DEF);
export const injectStreamConsent = /* @__PURE__ */ toInjectFn(STREAM_CONSENT_DEF);
export const STREAM_CONSENT_TOKEN = /* @__PURE__ */ toToken(STREAM_CONSENT_DEF);

// app.config.ts
createUserConsentProvider({
  for: STREAM_CONSENT_TOKEN,
  isGranted: () => inject(CookieService).streamingAllowed,
  grant: () => () => inject(CookieService).allowStreaming(),
});
```

`ConsentHandler` is `{ isGranted: Signal<boolean>; grant(): void; revoke?(): void }`. Consumers (like the [stream consent component](/components/stream)) inject the token and stay agnostic of your consent stack.

## Angular root element

`injectAngularRootElement()` returns a `Signal<HTMLElement | null>` resolving to the app's root component element once it has mounted. Inject-only — there is no provide counterpart.
