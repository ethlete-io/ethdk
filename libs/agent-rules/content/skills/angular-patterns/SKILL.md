---
name: angular-patterns
description: How to build Angular pieces the Ethlete way - templates, lifecycle, and when to reach for a component/directive/service/pipe vs a plain function. Read when writing or restructuring a component, directive, service, or pipe, wiring up lifecycle, or binding values in a template. Part of the Ethlete styleguide (judgment beyond what lint enforces).
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
<button [disabled]="isDisabled()">
  <!-- ✅ computed signal -->
  <button [disabled]="disabled()"></button>
</button>
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
- **Directives → plain functions where possible.** With signal APIs, move the core
  logic into a function so it's reusable without applying a directive; keep a
  directive only when a host element genuinely needs it. Avoid common input/output
  names that clash with the host component.
- **Pipes → a `computed()` calling a utility function.** Pipes carry no logic;
  most can be dropped in favour of a `computed`.

## Components

- Inline template/styles for small components; external `.html` / `.css` files
  for complex ones.
- Component CSS is plain CSS wrapped in `@layer components`, with every colour coming
  from a theme token — see {%skill:theming%}.

## Reactive state

Signals vs RxJS, subscriptions, and effects have their own guide:
{%skill:rxjs-signals%}.
