# Style Guide v0.15.0

This document outlines the coding style guide for Angular applications at Braune Digital.

**This guide is a work in progress and will be updated regularly.**

> **Enforcement:** most rules below are enforced automatically by
> `@ethlete/eslint-plugin` — run `npx nx lint <project>` and fix what it reports,
> rather than hand-checking. When working with an agent, the **`styleguide`** skill
> distills the judgment calls lint can't check, and **`component-architecture`**
> covers component structure.

## TL;DR

Key standards at a glance. **Most are enforced by lint** (see [Enforced by lint](#enforced-by-lint)); the rest are judgment calls documented in the sections below. Not exhaustive.

- **Types**: `unknown` not `any`; `type` not `interface`; `as const` objects not `enum`; `T`-prefixed descriptive generics; regular value imports (no `import type`); narrow with type guards.
- **Code**: `const` by default (`let` only to reassign, never `var`); one declaration per statement; `===` / `!==`; arrow fns standalone, methods in classes; max two params (object param beyond that).
- **State**: signals for synchronous state, RxJS for async — always unsubscribe; effects for signal-driven side effects.
- **Angular**: `ViewEncapsulation.None`; `inject()` not constructor injection; no legacy lifecycle hooks — prefer `constructor` + `afterNextRender` + `DestroyRef.onDestroy`; no function calls in templates except signal reads.
- **Naming & structure**: name things after what they do; routing components end in `-view`; mirror routes in folders; keep related files together.
- **Changesets**: one focused, imperative-mood entry per change (see the `changeset` skill).

---

## Enforced by lint

Run `npx nx lint <project> --fix` — the rules below are enforced (and mostly auto-fixed) by `@ethlete/eslint-plugin` (`libs/eslint-plugin/src/configs/recommended.js`). This table is a lookup for _why_ a fix was applied; don't hand-check these.

| Rule                                                                                                                              | Enforced by                                                                                                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No `any` / `$any()`; use `unknown` + type guards                                                                                  | `@typescript-eslint/no-explicit-any`, `@angular-eslint/template/no-any`                                                                                                                                             |
| No `interface` — use `type`                                                                                                       | `@typescript-eslint/consistent-type-definitions`                                                                                                                                                                    |
| No `enum` — use an `as const` object + derived union                                                                              | `no-restricted-syntax`                                                                                                                                                                                              |
| No `var`; prefer `const`; one declaration per statement                                                                           | `no-var`, `prefer-const`, `one-var`                                                                                                                                                                                 |
| `===` / `!==` only                                                                                                                | `eqeqeq`                                                                                                                                                                                                            |
| Max two function parameters                                                                                                       | `max-params`                                                                                                                                                                                                        |
| No `import type` / inline `type` specifiers                                                                                       | `ethlete/no-type-only-import`                                                                                                                                                                                       |
| Generic params `T`-prefixed (`TValue`), never bare `T`                                                                            | `@typescript-eslint/naming-convention`                                                                                                                                                                              |
| No `async`/`await` — use RxJS                                                                                                     | `no-restricted-syntax`                                                                                                                                                                                              |
| Arrow fns standalone; methods in classes; no arrow-fn class props; no `function` keyword                                          | `no-restricted-syntax`                                                                                                                                                                                              |
| Blank line before `return` in multi-line guard clauses                                                                            | `ethlete/guard-return-newline`                                                                                                                                                                                      |
| No trivially-inferable explicit return types                                                                                      | `ethlete/no-trivial-return-type`                                                                                                                                                                                    |
| camelCase / PascalCase / UPPER*CASE; no `#` or `*` member prefixes                                                                | `@typescript-eslint/naming-convention`, `ethlete/no-leading-underscore-class-member`                                                                                                                                |
| No SCREAMING_CASE locals; class constants `readonly` + SCREAMING_CASE                                                             | `ethlete/no-screaming-case-local`, `ethlete/class-constant-property`                                                                                                                                                |
| No `readonly` on reactive members (signals, inputs, computed, inject)                                                             | `ethlete/no-readonly-signal`                                                                                                                                                                                        |
| No `static` members                                                                                                               | `no-restricted-syntax`                                                                                                                                                                                              |
| Injected providers `private` by default, `protected` only when template/host-visible; explicit accessibility on reachable members | `ethlete/inject-member-accessibility`, `ethlete/template-member-accessibility`                                                                                                                                      |
| No `inject(X).member` chaining; no pure member aliases                                                                            | `ethlete/no-inject-chain`, `ethlete/no-member-alias`                                                                                                                                                                |
| No redundant `@internal` on `private`/`protected` members                                                                         | `ethlete/no-redundant-internal`                                                                                                                                                                                     |
| Observable vars/props end with `$`                                                                                                | `ethlete/require-dollar-suffix`                                                                                                                                                                                     |
| No body in `subscribe()`; no `subscribe` in `pipe()`; no RxJS in `effect()`/`computed()`                                          | `ethlete/no-subscribe-with-body`, `ethlete/no-subscribe-in-pipe`, `ethlete/no-rxjs-in-effect`                                                                                                                       |
| `ViewEncapsulation.None`                                                                                                          | `ethlete/require-view-encapsulation-none`                                                                                                                                                                           |
| No legacy lifecycle hooks; no legacy Angular decorators (`@HostBinding`, `@Input`, …)                                             | `no-restricted-syntax`, `ethlete/no-legacy-angular-decorators`                                                                                                                                                      |
| No `@Injectable`; no route guards; no resolvers                                                                                   | `no-restricted-syntax`                                                                                                                                                                                              |
| Outputs: no `on` prefix, no native event names                                                                                    | `@angular-eslint/no-output-on-prefix`, `@angular-eslint/no-output-native`                                                                                                                                           |
| No logic in pipe `transform`                                                                                                      | `ethlete/no-pipe-logic`                                                                                                                                                                                             |
| Consistent class-member + decorator-metadata order; concise host-directive / style metadata                                       | `ethlete/class-member-order`, `ethlete/angular-decorator-property-order`, `ethlete/prefer-concise-angular-host-directives`, `ethlete/prefer-concise-angular-style-metadata`                                         |
| Routing components: `-view` path + `ViewComponent` class name                                                                     | `ethlete/enforce-routing-view-naming`                                                                                                                                                                               |
| No direct `document` / `window` / DOM query / observers / cookies / `window.location`                                             | `no-restricted-globals`, `ethlete/no-direct-dom-manipulation`, `ethlete/no-dom-query`, `ethlete/no-native-observers`, `ethlete/no-document-cookie`, `ethlete/no-window-location`                                    |
| No barrel (index) imports — import from the source file                                                                           | `no-restricted-syntax`                                                                                                                                                                                              |
| Prefer `@ethlete/core` utils over raw APIs (clone/equal, rxjs timers, media query, viewport size, SEO, locale, router state)      | `ethlete/prefer-clone-equal`, `ethlete/prefer-rxjs-timer`, `ethlete/prefer-match-media`, `ethlete/prefer-viewport-size`, `ethlete/no-angular-seo-services`, `ethlete/no-locale-id`, `ethlete/no-angular-router-api` |

## Accessibility & visibility

Lint auto-fixes injected providers to `private` and flags template/host-visible members, but the _intent_ is yours:

- Injected provider → `private` by default; `protected` **only** when referenced from the HTML template or a `host:` binding expression; **drop the modifier entirely** if keeping it `private` would force a member alias (a property whose sole purpose is re-exposing a nested member — expose the injected symbol directly instead).
- Never add a member that only **aliases** another member's nested property (`foo = this.thing.foo`) — widen the source member's visibility and use it directly.
- For a member that must stay technically public purely for cross-class/DI use (e.g. a self-registration method called by a sub-directive), keep it `public` and tag `/** @internal */` so build tooling strips it from the published `.d.ts`. Never put `@internal` on `private`/`protected` members.

## Naming & functions with intent

Case conventions, the `T` generic prefix, arrow-vs-method, and the two-param limit are all lint-enforced. What lint can't judge:

- **Name things after what they do**, not after the mechanism. `onChange` that posts a form → `sendFormValueToApi`. Descriptive generics (`TValue`, `TResult`), descriptive constant/variable names.
- When a function needs more than two parameters, take a single **object parameter** with a named `type` rather than widening the signature.

```ts
// ❌ name describes the trigger, not the behaviour
const onChange = () => sendToApi(myForm.getRawValue());

// ✅ name describes the behaviour
const sendFormValueToApi = () => sendToApi(myForm.getRawValue());

// ✅ object param instead of a third positional arg
type LogMessageConfig = { scope: string; logLevel: string };
const logMessage = (message: string, config: LogMessageConfig) => {};
```

## TypeScript Config

- Ensure `strict` is set to `true`.
- Ensure `noUncheckedIndexedAccess` is set to `true`.
- Keep the remaining defaults provided by NX
- Set `resolveJsonModule` to `true` only if necessary. JSON files should be fetched via HTTP requests.
- Set `esModuleInterop` to `true` only if necessary.

## Signals vs RxJS

- **Synchronous state → signals. Asynchronous work → RxJS.** Never model sync state with a `BehaviorSubject`; never use RxJS just to read a value back synchronously. Bridge with `toSignal()` / `toObservable()` instead of copying values across with `.subscribe()`.
- **Always unsubscribe.** Prefer `takeUntilDestroyed()`; otherwise `take` / `takeUntil` / `takeWhile`, and place the limiting operator **last** in the pipe. Side effects go in `tap()`, not the `subscribe()` callback. (Lint blocks bodies in `subscribe()` but cannot prove you unsubscribe.)
- Don't reach for RxJS inside `effect()` / `computed()` — model the stream with `toObservable(signal).pipe(switchMap(...))` instead of subscribing per run.

```ts
// ❌ sync state as a subject          // ✅ signal
const count$ = new BehaviorSubject(0);
const count = signal(0);

// ✅ react to a signal without subscribing inside an effect
toObservable(page)
  .pipe(
    switchMap((p) => fetchPage(p)),
    tap(handle),
    takeUntilDestroyed(),
  )
  .subscribe();
```

## Angular patterns

Lint covers the mechanical Angular rules (`ViewEncapsulation.None`, no legacy hooks/decorators, no native DOM/`window`, output naming, class-member + decorator-metadata order, no `@Injectable` / guards / resolvers). The judgment calls:

- **No function calls in template value bindings except signal reads** — a method in a binding re-runs every change-detection cycle. Move it into a `computed()` and bind that. Event bindings (`(click)="save()"`) are fine.
- **Prefer the `constructor`** (runs in the injection context) over `ngOnInit` / `ngOnDestroy`: `afterNextRender()` for first-render work, `inject(DestroyRef).onDestroy(...)` for cleanup.
- **Prefer utility functions + provider factories over services** — `createProvider` / `createRootProvider` and the `injectX()` helper pattern from `@ethlete/core`, not an `@Injectable`.
- **Most directives can be plain functions.** Move the logic into a function so it's reusable without applying a directive; keep a directive only when a host element genuinely needs it. Avoid common input/output names that clash with the host component.
- **Pipes carry no logic** — put it in a utility function called from a `computed()`; most pipes can be replaced by a `computed` outright.
- **Components**: inline template/styles for small components, external `.html` / `.css` files for complex ones.

```html
<!-- ❌ runs every CD cycle -->
<button [disabled]="isDisabled()">
  <!-- ✅ computed signal -->
  <button [disabled]="disabled()"></button>
</button>
```

## General File Structure

Given are the following routes:

```ts
import { Routes } from '@angular/router';

export const SHOP_ROUTES: Routes = [
  {
    path: 'items',
    loadComponent: () => import('./items-list-view/items-list-view.component').then((m) => m.ItemsListViewComponent),
  },
  {
    path: 'items/:id',
    loadComponent: () => import('./item-detail-host-view/item-detail-host-view.component').then((m) => m.ItemDetailHostViewComponent),
    children: [
      {
        path: '',
        loadComponent: () => import('./item-detail-host-view/item-detail-view/item-detail-view.component').then((m) => m.ItemDetailViewComponent),
      }
      {
        path: 'reviews',
        loadComponent: () => import('./item-detail-host-view/item-reviews-view/item-reviews-view.component').then((m) => m.ItemReviewsViewComponent),
      }
    ]
  }
];
```

- Organize folder and file structure to mirror Angular routes.
- Name routing components with the suffix `view` (e.g., `settings-view.component.ts`).
- Place reusable components in a `components` directory.
- Always include an `index.ts` file to export components.
- For components with inline templates, place them directly in the `components` directory without nesting.
- Place child components specific to a parent component in a `partials` directory.
- Restrict the usage of partial components to their parent component only. For example, the `item-image` and `item-price` components should only be used within the `item-card` component.
- Similarly, components like `item-card` should only be used within their parent view (`items-list-view`). If needed elsewhere, move them higher in the directory structure.
- Create and place directives, pipes, and utilities in the same directory as the component that uses them. For example, place `item-status.pipe.ts` in the `item-card` directory.
- Position services and providers in the directory of the view component that includes them in its `providers` array. For example, place `item-detail-api.service.ts` in the `item-detail-host-view` directory.
- Use simple file names for utility files without the `.utils.ts` suffix. For example, use `items-list-filter-form.ts` for files containing form configurations.
- Always put storybook files in a `storybook` directory within the component directory. This directory should contain the storybook component and any dummy data needed for the storybook.

```plaintext
shop/
├── items-list-view/
│   ├── components/
│   │   ├── item-card/
│   │   │   ├── partials/
│   │   │   │   ├── item-image/
│   │   │   │   │   ├── item-image.component.ts
│   │   │   │   │   ├── item-image.component.html
│   │   │   │   │   ├── index.ts ✅ (exports the item image component)
│   │   │   │   ├── item-price/
│   │   │   │   │   ├── item-price.component.ts
│   │   │   │   │   ├── item-price.component.html
│   │   │   │   │   ├── index.ts ✅ (exports the item price component)
│   │   │   ├── storybook/
│   │   │   │   ├── item-card.component.stories.ts
│   │   │   │   ├── item-card-storybook-data.ts
│   │   │   ├── item-card.component.ts
│   │   │   ├── item-card.component.html
│   │   │   ├── item-status.pipe.ts
│   │   │   ├── index.ts ✅ (exports the item card component)
│   ├── items-list-view.component.ts
│   ├── items-list-view.component.html
│   ├── items-list-filter-form.ts
├── items-detail-host-view/
│   ├── item-detail-host-view.component.ts
│   ├── item-detail-host-view.component.html
│   ├── item-detail-api.service.ts
│   ├── item-data.provider.ts
│   ├── item-detail-view/
│   │   ├── item-detail-view.component.ts
│   │   ├── item-detail-view.component.html
│   ├── item-reviews-view/
│   │   ├── item-reviews-view.component.ts
│   │   ├── item-reviews-view.component.html
```

#### Miscellaneous

- Super generic components and other logic (e.g., buttons, inputs, etc.) should be placed in a uikit directory.
- Things placed in the uikit directory should be as generic as possible and should not contain any business logic (dumb components).
- Components and logic needed for the app shell (e.g., header, footer, etc.) should be placed in a shell directory.
- To reduce the risk of circular dependencies, avoid importing from the parent directory in a subdirectory.

### NX Workspace

- Apps should be placed in the `apps` directory. They should contain the main application logic and should be as slim as possible. No business logic should be placed in the app directory besides the app component.
- Libraries should be placed in the `libs` directory.
  - They should be `buildable`.
  - They should have a clear import path (e.g., `@org/domain/my-app` or `@org/uikit`). The import path can be found in the project.json file and should be checked after generation.
  - They should have a clear name (e.g. `domain-my-app` or `uikit`). The name can be found in the project.json file and should also be checked after generation.

The following abstract example shows a correct file structure:

```plaintext
apps/
│   ├── my-app/
│   │   ├── src/...
│   ├── other-app/
│   │   ├── src/...
libs/
│   ├── assets/
│   │   ├── src/...
│   ├── domain/
│   │   ├── my-app/
│   │   │   ├── src/...
│   │   ├── other-app/
│   │   │   ├── src/...
│   ├── env/
|   │   ├── src/...
│   ├── queries/
│   │   ├── src/...
│   ├── types/
│   │   ├── src/...
│   ├── uikit/
│   │   ├── src/...
```

- The `assets` library should contain all assets used across applications.
- The `domain` library should contain all domain-specific logic. Each domain should have its own library.
- The `env` library should contain the `environment` files. This way they can be shared across applications and libraries.
- The `queries` library should contain all queries used across applications.
- The `types` library should contain common types used across applications and libraries (e.g. API types).
- The `uikit` library should contain all shared components and logic.

### Assets

- Place all assets in the `assets` library.
- Given the apps `my-app` and `other-app`, the assets library should be structured as follows:

```plaintext
assets/
│   ├── my-app/
│   │   ├── build/
│   │   ├── serve/
│   │   ├── storybook/
│   ├── other-app/
│   │   ├── build/
│   │   ├── serve/
│   │   ├── storybook/
│   ├── shared/
│   │   ├── build/
│   │   ├── serve/
│   │   ├── storybook/
```

- The storybook directory is optional and can be used for assets that are only needed in Storybook (e.g., dummy data, storybook-specific assets).
- The serve directory is optional and can be used for assets that are only needed during development (e.g., placeholder assets). These assets are not included in the build process.
- The build directory should contain all assets that are needed in production.
- Adjust each app's `project.json` file to include the assets as follows:

```json
{
  "build": {
    "executor": "@angular/build:application",
    "outputs": ["{options.outputPath}"],
    "options": {
      // ...
      "assets": [
        {
          "input": "libs/assets/src/APP_NAME_HERE/build",
          "glob": "**/*",
          "output": "assets" // There should be no separate build directory for build assets.
        },
        {
          "input": "libs/assets/src/APP_NAME_HERE/serve",
          "glob": "**/*",
          "output": "assets/serve"
        },
        // If shared assets are needed, include them as well
        {
          "input": "libs/assets/src/shared/build",
          "glob": "**/*",
          "output": "assets/shared"
        },
        {
          "input": "libs/assets/src/shared/serve",
          "glob": "**/*",
          "output": "assets/shared/serve"
        }
      ]
      // ...
    },
    "configurations": {
      "production": {
        "assets": [
          {
            "input": "libs/assets/src/APP_NAME_HERE/build",
            "glob": "**/*",
            "output": "assets"
          },
          // If shared assets are needed, include them as well
          {
            "input": "libs/assets/src/shared/build",
            "glob": "**/*",
            "output": "assets/shared"
          }
        ]
      },
      // If you have a Storybook setup, you can add configurations for development and production environments.
      // Make sure to add zone.js as a polyfill. This is currently still required for Storybook to work properly.
      "storybook-development": {
        "polyfills": ["zone.js"],
        "assets": [
          {
            "input": "libs/assets/src/APP_NAME_HERE/serve",
            "glob": "**/*",
            "output": "assets/serve"
          },
          {
            "input": "libs/assets/src/APP_NAME_HERE/storybook",
            "glob": "**/*",
            "output": "assets"
          },
          {
            "input": "libs/assets/src/APP_NAME_HERE/build",
            "glob": "**/*",
            "output": "assets"
          },
          // If shared assets are needed, include them as well
          {
            "input": "libs/assets/src/shared/build",
            "glob": "**/*",
            "output": "assets/shared"
          },
          {
            "input": "libs/assets/src/shared/serve",
            "glob": "**/*",
            "output": "assets/shared/serve"
          },
          {
            "input": "libs/assets/src/shared/storybook",
            "glob": "**/*",
            "output": "assets/shared/storybook"
          }
        ]
      },
      "storybook-production": {
        "polyfills": ["zone.js"],
        "assets": [
          {
            "input": "libs/assets/src/APP_NAME_HERE/storybook",
            "glob": "**/*",
            "output": "assets"
          },
          {
            "input": "libs/assets/src/APP_NAME_HERE/build",
            "glob": "**/*",
            "output": "assets"
          },
          // If shared assets are needed, include them as well
          {
            "input": "libs/assets/src/shared/build",
            "glob": "**/*",
            "output": "assets/shared"
          },
          {
            "input": "libs/assets/src/shared/storybook",
            "glob": "**/*",
            "output": "assets/shared/storybook"
          }
        ]
      }
    }
  }
}
```

#### Asset examples

- Given the `cat.jpg` image used in the `my-app` application, the asset should be placed in the `libs/assets/src/my-app/build` directory.
- Subdirectories can be used to organize assets further, such as `libs/assets/src/my-app/build/images/cat.jpg`.

```plaintext
assets/
│   ├── my-app/
│   │   ├── build/
│   │   │   ├── images/
│   │   │   │   ├── cat.jpg
```

This way, the asset can be accessed in the application as follows:

```html
<img src="assets/images/cat.jpg" alt="Cat Image" />
```

- If the asset is only needed during development (e.g., as a mock placeholder image)
  - Place it in the `libs/assets/src/my-app/serve/images/cat.jpg`.
  - The asset can then be accessed in the application as follows:

```html
<img src="assets/serve/images/cat.jpg" alt="Cat Image" />
```

**Keep in mind** that the `serve` directory is optional and can be used for assets that are only needed during development. These assets are not included in the build process.

### Storybook

- If extra components are needed to render a component in Storybook, they should be placed in a `storybook` directory within the component directory.
- **Never** export storybook specific logic from the component directory.

```plaintext
settings-form/
│   ├── storybook/
│   │   ├── settings-form.storybook.component.ts
│   │   ├── settings-form.storybook.component.html
│   │   ├── settings-form-dummy-data.ts
│   │   ├── index.ts ✅ (exports the storybook component for use in the .stories.ts file + dummy data if needed)
│   ├── settings-form.component.ts
│   ├── settings-form.component.stories.ts
│   ├── settings-form.component.html
│   ├── index.ts ✅ (exports the form component)
```

## Changesets

- Use `@changesets` to manage changelogs.
- **Do not** create a changeset for irrelevant changes (e.g., formatting, comments, internal refactoring).
- **Do not** create a changeset for fixes to features that have not yet been released.
- **Do not** include multiple changes in a single changeset. Each changeset should contain only one change.
- **Always** start a changeset with at least one sentence describing the change. Optional follow-up markdown can be added after the initial sentence.
- Create changesets for dependency updates if they are relevant to the project (e.g., major version updates).
- Write changesets in the imperative mood. For example:
  - Add button component
  - Fix spacing issues inside buttons
  - Update to Angular 20

### Examples

Use the following legend to determine the type of changeset you should create.  
**Do not** include the emoji in your changeset message; it is only used here for clarity.

- ✨ **Major Change**: For breaking changes that require updates or modifications by consumers of the project.
  - Example: Remove settings view from the app.

- 🚀 **Minor Change**: For adding new features or functionality in a backward-compatible way.
  - Example: Add support for dark mode in components.

- 🐛 **Patch Change**: For bug fixes or small adjustments that do not introduce breaking changes.
  - Example: Fix button alignment issue.

#### Valid Changesets

The following changesets are valid and should be created:

- ✨ Migrate to NX 20
- 🚀 Add button component
- 🚀 Add text input component
- 🚀 Add settings view
- 🚀 Add uikit library
- 🚀 Add login app
- 🚀 Update TypeScript configurations to allow usage of ES2027
- 🚀 Make CI pipelines faster by caching `node_modules`

#### Special Cases

For these types of changesets, ensure that the feature you are working on has already been released (and can be found in the changelog). If the feature is not yet released, **do not** create a changeset for it.

- ✨ Change route of settings view from `/settings` to `/user/settings`
- ✨ Rename `MatchComponent` to `MatchupComponent`
- 🚀 Add general tab to settings view
- 🐛 Fix issue with settings view not loading on mobile devices
- 🐛 Enhance button component rendering to improve performance
- 🐛 Fix typo in settings view headline
- 🐛 Fix linting issues inside progress bar component

#### Invalid Changesets

The following changesets are generally invalid and should **not** be created:

- Cleanup code inside button component (no changeset needed).
- Update Angular to 19.1.1 from 19.1.0 (it's a patch update and does not require a changeset).
- Move button component to a new directory (if it remains in the same NX library, no changeset is needed. Otherwise, it's a ✨).
- Run Prettier on all files (no changeset needed).
- Fix button style on hover **and** update slider component bar thickness (two changes should not be combined into one changeset).
