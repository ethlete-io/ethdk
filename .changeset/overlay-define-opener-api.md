---
'@ethlete/components': major
---

Overlay: replace the curried overlay handler API with an explicit define/create pair, and merge overlay configs additively instead of replacing them.

- `createOverlayHandler` and `createOverlayHandlerWithQueryParamLifecycle` are removed. Define an overlay once at module scope with `defineOverlay({ component, ...config })` (or `defineQueryParamOverlay({ component, queryParamKey, ...config })` for URL-driven overlays), then create an opener in an injection context with `createOverlayOpener(definition, { afterClosed, ...config })`.
- Overlay configs now merge additively across definition → opener → per-open layers: `bindings`, `providers`, `hostClass`, `backdropClass` and `panelClass` are concatenated instead of the most specific layer silently replacing the rest; scalar options still follow most-specific-wins. The merge is exposed as `mergeOverlayConfigs(...configs)`.
- Inside the overlay component, access the typed ref via `definition.injectRef()` (replaces the handler's `injectOverlayRef`). It throws an actionable `RuntimeError` when called outside an open overlay.
- `defineQueryParamOverlay` requires the component to expose an `overlayQueryParam` model at compile time (previously a silent runtime requirement), and the opener's `open(value)` is typed from that model's value type. Definition- and opener-level `bindings`/`providers` are now applied on every URL-driven open, so components with additional inputs work with query-param overlays.
- `OverlayHandlerLinkDirective` (`etOverlayHandlerLink` + `etOverlayHandlerQueryParamName`) is replaced by `QueryParamOverlayLinkDirective`: `<a [etQueryParamOverlayLink]="definition" etQueryParamOverlayLinkValue="42">` — the link takes the definition object, so the query param key is no longer duplicated as a string.

Migration:

```ts
// before
const openProductOverlay = createOverlayHandlerWithQueryParamLifecycle<ProductOverlayComponent>({
  component: ProductOverlayComponent,
  strategies: dialogOverlayStrategy({ maxWidth: '480px' }),
  queryParamKey: 'product',
});
// in a component
handler = openProductOverlay();

// after
export const productOverlay = defineQueryParamOverlay({
  component: ProductOverlayComponent,
  strategies: dialogOverlayStrategy({ maxWidth: '480px' }),
  queryParamKey: 'product',
});
// in a component
opener = createOverlayOpener(productOverlay);
```
