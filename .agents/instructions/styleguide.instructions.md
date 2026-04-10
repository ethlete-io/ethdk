---
applyTo: '**'
---

# Coding Style Rules

Refer to the rules below for all style checks. Only consult `docs/STYLEGUIDE.md` if a rule is unclear or missing from this file. Do not load the full styleguide unless necessary.

## TypeScript

- **No `any` / `$any()`** — use `unknown` + type guards
- **No `interface`** — always use `type`
- **No TypeScript `enum`** (not even `const enum`) — use `const` object + derived union type: `export const FOO = { A: 'a' } as const; type Foo = typeof FOO[keyof typeof FOO];`
- **No `import type` / inline `type` specifiers** — always use a regular value import: `import { Foo } from 'bar'`, never `import type { Foo } from 'bar'` or `import { type Foo } from 'bar'`
- **Generics** — always descriptive, always `T`-prefixed: `TValue`, `TResult`, never single-letter `T`
- **No `async/await`** — use RxJS for all async operations

## Naming & Formatting

- **No `snake_case`** anywhere
- **`SCREAMING_CASE`** for module-level constants and `readonly` class-level constant properties — not inside functions, not for function names
- **`NormalCase`** for class names; **`camelCase`** for everything else
- **No `var`**, no unnecessary `let` — default to `const`
- **Never** declare multiple variables in one `const`/`let` statement
- **Always `===` / `!==`** — never `==` / `!=`

## Functions

- **Arrow functions** for standalone code; **regular methods** inside classes — never arrow properties inside classes, never `function` keyword
- Max two parameters; use an object parameter for more
- Function names must describe behavior, not event context (`sendFormToApi` not `onChange`)
- Multi-line guard clauses: add an empty line before the `return`; single-line guards (`if (x) return;`) need no empty line
- **No explicit return types** unless TypeScript cannot infer them, or the inferred type would be unwieldy compared to a hand-written one — omit `: void`, `: boolean`, `: string`, etc. always

## Classes & Angular DI

- **Never use `_` or `#` prefixes** on any class member, regardless of visibility
- **`@internal` JSDoc tag** — use on members that must be technically public (e.g. for DI / self-registration) but are not part of the consumer API; this is the only approved alternative to `private`
- **`private` / `protected` keyword** — only enforced for injected providers (`inject(...)`); for all other class members (inputs, outputs, viewChild results, computed signals, observables, methods, etc.) visibility is the author's choice and must not be flagged
- **Never `public` or `static`**; **never `protected`** unless absolutely necessary — template usage (the member is referenced in the HTML template file) **or `host:` binding expressions** in the `@Component` / `@Directive` decorator count as absolutely necessary
- **`readonly`** only for true constants in a class (`readonly ID`, `readonly SELECT_OPTIONS`) — not for signals, inputs, computed, methods, injected symbols, etc.
- **`inject()`** for all DI — no constructor injection; never chain `inject(Service).member`

## Angular

- **`ChangeDetectionStrategy.OnPush`** always
- **`ViewEncapsulation.None`** always
- **No function calls in templates** as value bindings — use `computed()` signals instead; event bindings `(click)="fn()"` are fine
- **No legacy lifecycle hooks** (`ngOnChanges`, `ngAfterViewInit`, `ngAfterContentInit`, etc.)
- **Minimise `ngOnInit`/`ngOnDestroy`** — prefer constructor (runs in injection context); use `afterNextRender` for post-render init, `inject(DestroyRef).onDestroy` for cleanup
- **No native DOM APIs** (`document.`, `window.`) directly
- **Output names** must not start with `on` (`selectDate` not `onSelectDate`)
- **No reserved input names** (`title`, `change`, `hidden`, etc.)

### Class member order

**Initialization dependency trumps all** — if a member's initializer references another member, the referenced member must appear first, regardless of the default order below. Use the list as the default tiebreaker when members are independent:

1. DI (`inject(...)`)
2. Inputs
3. Outputs
4. viewChild / viewChildren / contentChild / contentChildren
5. Private members / computed
6. Public members / computed / forms / external utilities
7. Constructor (effects, `afterNextRender`, `DestroyRef.onDestroy`)
8. Public methods
9. Private methods

### Services / Pipes / Directives

- Services: prefer modular utility functions; `createRootProvider` and such from `@ethlete/core` should be used instead of Services
- Pipes: no logic in pipes — extract to a utility function preferably in the same file
- Directives: prefer extracting core logic into a utility function reusable outside the directive

## RxJS

- Use for all async; use signals for synchronous state
- **No `.subscribe()` inside a pipe**
- **No `.subscribe()` to extract data** — use `toSignal()`
- Always unsubscribe: `takeUntilDestroyed()` (preferred), `.unsubscribe()`, or `takeUntil`/`takeWhile`/`take` — **place cleanup operator last in the pipe**
- Keep `subscribe()` callback empty; use `tap` for side effects
- **No RxJS inside `effect()` or `computed()`** — use `toObservable()` + `switchMap` instead
- Use `$` suffix for observable variables
