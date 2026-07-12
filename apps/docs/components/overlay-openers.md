# Overlay openers

Opening an overlay (dialog, sheet, …) imperatively involves three pieces with clearly separated jobs:

| Piece          | Created by                                  | Lives                           | Job                                                     |
| -------------- | ------------------------------------------- | ------------------------------- | ------------------------------------------------------- |
| **Definition** | `defineOverlay` / `defineQueryParamOverlay` | Module scope (no DI)            | Binds the component to its base config, once            |
| **Opener**     | `createOverlayOpener(definition)`           | Injection context (a component) | Opens/closes overlays, wires lifecycle callbacks        |
| **Ref**        | `definition.injectRef()`                    | Inside the overlay component    | Typed access to the open overlay (close with a result…) |

```ts
// product-overlay.ts — module scope, no injection context needed
import { defineOverlay, dialogOverlayStrategy } from '@ethlete/components';

export const productOverlay = defineOverlay<ProductOverlayComponent, ProductResult>({
  component: ProductOverlayComponent,
  strategies: dialogOverlayStrategy({ maxWidth: '480px' }),
});
```

```ts
// any component that opens it
import { createOverlayOpener } from '@ethlete/components';

export class ProductListComponent {
  private product = createOverlayOpener(productOverlay, {
    afterClosed: (result) => console.log('closed with', result),
  });

  protected showProduct() {
    this.product.open();
  }
}
```

```ts
// inside ProductOverlayComponent
export class ProductOverlayComponent {
  protected overlayRef = productOverlay.injectRef(); // OverlayRef<ProductOverlayComponent, ProductResult>

  protected save() {
    this.overlayRef.close({ saved: true });
  }
}
```

The two generics on `defineOverlay<TComponent, TResult>` are the overlay component and the close-result type. `TResult` flows into `afterClosed` / `beforeClosed` callbacks and into `injectRef().close(...)`.

## Live demo

<StoryEmbed id="components-overlay-using-openers--default" height="420px" />

## Passing data into the overlay

Inputs and outputs use Angular's native binding API (`inputBinding`, `outputBinding`, `twoWayBinding`); services use `providers`. Both are regular `OverlayConfig` options, so they can be set at **any** layer — on the definition, on the opener, or per `open()` call:

```ts
this.product.open({
  bindings: [
    inputBinding('productId', () => this.selectedId()),
    outputBinding('reserved', (amount: number) => this.updateStock(amount)),
  ],
  providers: [{ provide: PRODUCT_CONTEXT, useValue: this.context }],
});
```

## How configs merge

Configs merge **additively** from least to most specific: definition → opener → per-open. The merge is exposed as `mergeOverlayConfigs(...configs)` if you need it yourself.

| Config keys                                | Merge behavior                                                                                           |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `bindings`, `providers`                    | Concatenated in layer order — a later binding/provider for the same input/token wins (Angular semantics) |
| `hostClass`, `backdropClass`, `panelClass` | Normalized to arrays, concatenated, deduped                                                              |
| Everything else (`origin`, `role`, …)      | Most specific layer wins; `undefined` never overrides, an explicit `null` (aria fields) does             |
| `strategies`, `component`                  | Fixed by the definition — not overridable                                                                |

So a `panelClass` on the definition and another on the opener both end up on the pane, and per-open `bindings` extend (rather than replace) the definition's bindings.

## Lifecycle callbacks

The opener config takes three callbacks alongside the overlay config overrides. They are subscribed per open and cleaned up automatically with the opener's injection context:

```ts
private product = createOverlayOpener(productOverlay, {
  afterOpened: () => {},
  beforeClosed: (result) => {}, // result: ProductResult | null
  afterClosed: (result) => {},
});
```

## The overlay ref

Inside the overlay component, `definition.injectRef()` returns the fully typed `OverlayRef`. It must be called in the component's injection context (field initializer or constructor) and throws an actionable [`RuntimeError`](/core/utilities#runtime-errors) when no overlay is open — e.g. when the component is accidentally rendered outside an overlay.

## Query-param overlays

`defineQueryParamOverlay` creates an overlay whose lifecycle is driven by a URL query param: it opens while the param is present, closes (clearing the param) when dismissed, and survives deep links and browser back/forward.

The component **must** expose an `overlayQueryParam` [model](https://angular.dev/api/core/model) — this is enforced at compile time. It receives the param value and is kept in two-way sync with the URL: writing to the model updates the URL, external URL changes are pushed into the model.

```ts
import { defineQueryParamOverlay, dialogOverlayStrategy } from '@ethlete/components';

export class ProductOverlayComponent {
  public overlayQueryParam = model<string>();
}

export const productOverlay = defineQueryParamOverlay({
  component: ProductOverlayComponent,
  queryParamKey: 'product',
  strategies: dialogOverlayStrategy({ maxWidth: '480px' }),
});
```

The same `createOverlayOpener` consumes it, but the opener shape changes — it drives the URL instead of returning a ref:

```ts
private product = createOverlayOpener(productOverlay);

this.product.open('42'); // navigates to ?product=42 → overlay opens
this.product.close();    // clears the param → overlay closes
```

`open(value)` is typed from the component's model — `model<'grid' | 'list'>()` gives you `open('grid' | 'list')`.

::: tip Openers react for as long as they live
A query-param opener watches the URL from creation until its injection context is destroyed. Create it once in a long-lived component (the page that owns the overlay, or the app shell for globally deep-linkable overlays).
:::

### Opening from templates

`QueryParamOverlayLinkDirective` opens the overlay declaratively. It takes the definition itself, so the query param key is never duplicated as a string; the value can be a string or a number:

```html
<a [etQueryParamOverlayLink]="productOverlay" etQueryParamOverlayLinkValue="42">Show product 42</a>
```

### No per-open config

Opens are triggered by URL state (deep links, back/forward), not by a call site — so there is no per-open config. `bindings` and `providers` from the definition and the opener are applied on **every** open, which is where required inputs of the component belong. For the same reason, avoid setting `origin` on a query-param opener: a deep-linked open has no originating element (the overlay falls back to the currently focused element).

## API overview

| Export                                     | Kind      | Purpose                                                     |
| ------------------------------------------ | --------- | ----------------------------------------------------------- |
| `defineOverlay(config)`                    | function  | Overlay definition at module scope                          |
| `defineQueryParamOverlay(config)`          | function  | URL-driven overlay definition (`queryParamKey`)             |
| `createOverlayOpener(definition, config?)` | function  | Injection-context opener for either definition kind         |
| `definition.injectRef()`                   | method    | Typed `OverlayRef` inside the overlay component             |
| `mergeOverlayConfigs(...configs)`          | function  | The additive config merge used by openers                   |
| `QueryParamOverlayLinkDirective`           | directive | `[etQueryParamOverlayLink]` — declarative query-param opens |
| `OVERLAY_QUERY_PARAM_INPUT_NAME`           | const     | Name of the model contract (`'overlayQueryParam'`)          |

## Migrating from overlay handlers

`createOverlayHandler` and `createOverlayHandlerWithQueryParamLifecycle` were removed in favor of this API.

```ts
// before — curried: a factory returning a factory
const openProductOverlay = createOverlayHandlerWithQueryParamLifecycle<ProductOverlayComponent>({
  component: ProductOverlayComponent,
  strategies: dialogOverlayStrategy({ maxWidth: '480px' }),
  queryParamKey: 'product',
});

export class ShopComponent {
  handler = openProductOverlay();
}

// after — explicit define / create pair
export const productOverlay = defineQueryParamOverlay({
  component: ProductOverlayComponent,
  strategies: dialogOverlayStrategy({ maxWidth: '480px' }),
  queryParamKey: 'product',
});

export class ShopComponent {
  opener = createOverlayOpener(productOverlay);
}
```

- `handler.injectOverlayRef()` / the handler factory's static `injectOverlayRef` → `definition.injectRef()`.
- Lifecycle callbacks move from the handler's inner config into the `createOverlayOpener` config (same names).
- `OverlayHandlerLinkDirective` (`etOverlayHandlerLink` + `etOverlayHandlerQueryParamName`) → `QueryParamOverlayLinkDirective` (`[etQueryParamOverlayLink]="definition"` + `etQueryParamOverlayLinkValue`).
- Behavior change: configs now merge additively (see above) — previously the most specific layer silently replaced `bindings`, `providers` and class fields.

## Error codes

Calling `definition.injectRef()` outside a component opened by that definition throws [`ET1207`](/components/error-codes#overlay-et12xx).
