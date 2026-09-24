---
name: angular-patterns
description: How to build Angular pieces the Ethlete way - templates, lifecycle, and when to reach for a component/directive/service/pipe vs a plain function. Read when writing or restructuring a component, directive, service, or pipe, wiring up lifecycle, or binding values in a template.
kind: skill
scope: both
requires: ['@ethlete/core']
---

# Angular patterns

Lint covers the mechanical Angular rules (`ViewEncapsulation.None`, `inject()` not
constructor injection, no legacy lifecycle hooks / legacy decorators, no native
DOM/`window`, output naming, class-member + decorator-metadata order, no
`@Injectable` / `@Service` / guards / resolvers, no logic in pipes). The judgment calls:

## Templates

- **No function calls in value bindings except signal reads.** A method call in a
  binding re-runs on every change-detection cycle. Move the logic into a
  `computed()` and bind that. Event bindings (`(click)="save()"`) are fine.
  (This is _not_ lint-enforced.)

```html
<!-- ❌ runs every CD cycle -->
<button [disabled]="isDisabled()"></button>

<!-- ✅ computed signal -->
<button [disabled]="disabled()"></button>
```

- **Per-row formatting belongs in the data, not in a method per row.** Map the rows once
  in a `computed()` and bind the prepared fields. A pure, module-level formatting function
  is acceptable too; a component method called for each row in `@for` is not.

```ts
// ❌ <td>{{ formatDate(row.createdAt) }}</td> - re-runs for every row, every CD cycle
// ✅
rows = computed(() => this.items().map((item) => ({ ...item, createdAtLabel: formatDate(item.createdAt) })));
```

## Lifecycle

- **Prefer the `constructor`** (runs in the injection context) over `ngOnInit` /
  `ngOnDestroy`. Use `afterNextRender()` for first-render work and
  `inject(DestroyRef).onDestroy(() => …)` for cleanup.

## Reach for a function before a building block

- **Services → utility functions + provider factories.** Use `createProvider` /
  `createRootProvider` and the `injectX()` helper pattern from `@ethlete/core`
  rather than an `@Injectable` or `@Service`. (Both decorators are lint-banned;
  choosing a function over a service at all is the judgment.)
- **Repeated component logic → one `injectX()` function.** When two components carry the
  same signals, effects or subscriptions, extract them into an `injectX()` that runs in the
  injection context and returns what the components bind. Do not copy the block, and do not
  reach for a base class.
- **Directives → plain functions where possible.** With signal APIs, move the core
  logic into a function so it's reusable without applying a directive; keep a
  directive only when a host element genuinely needs it. Avoid common input/output
  names that clash with the host component.
- **Pipes → a `computed()` calling a utility function.** Pipes carry no logic;
  most can be dropped in favour of a `computed`.

## Query params

- **Read** them with the `@ethlete/core` signals: `injectQueryParam(key)`,
  `injectQueryParams()`. `ActivatedRoute` and `router.url` are lint-banned.
- **Write** them with `inject(Router).navigate([], { queryParams, queryParamsHandling: 'merge' })`.
  `merge` keeps the params you do not set; `null` removes a param.
- **Filter, sort and page state bound to the URL** is a query form: with `@ethlete/query`,
  use `defineQueryForm` instead of writing the params by hand.

## Components

- Inline template/styles for small components; external `.html` / `.css` files
  for complex ones.
- Component CSS is plain CSS wrapped in `@layer components`, with every primary colour
  value coming from the repository's theme tokens.

## Reactive state

Signals vs RxJS, subscriptions, and effects have their own guide:
{%skill:rxjs-signals%}.
