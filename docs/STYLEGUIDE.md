# Style Guide v0.10.0

This document outlines the coding style guide for Angular applications at Braune Digital.

**This guide is a work in progress and will be updated regularly.**

## TL;DR

A comprehensive summary of our key coding standards:

### Type System

- **Type Safety**: Use [`unknown`](#any-and-any) instead of `any`, [`type`](#type--interface) over `interface`, descriptive [generics](#generics)
- **Generics**: Always start with `T` (e.g., `TValue`, `TResult`) and use [descriptive names](#generics)
- **Constants**: Use [object literals with `as const`](#enums) instead of enums
- **Type Assertions**: Use [type guards](#any-and-any) to narrow types rather than forced assertions

### Code Structure

- **Variables**: Use [`const`](#variables) by default, `let` only when necessary, never use `var`
- **Functions**: Use [arrow functions](#functions) for standalone code, regular methods in classes
- **Equality**: Always use [`===` and `!==`](#equality-checks) for comparisons
- **Private Members**: Use the [`private` keyword](#private), not `#` or `_` prefix
- **Async**: Prefer [RxJS](#async--try-catch) over `async/await` for asynchronous operations

### Angular Practices

- **Change Detection**: Always use [`OnPush`](#components-directives-services--pipes-and-other-angular-specific-rules) strategy
- **Encapsulation**: Always use [`ViewEncapsulation.None`](#components)
- **Dependency Injection**: Use [`inject()`](#inject) instead of constructor injection
- **Lifecycle**: Avoid [legacy lifecycle hooks](#components-directives-services--pipes-and-other-angular-specific-rules), use signals and effects
- **Templates**: Avoid [function calls](#components-directives-services--pipes-and-other-angular-specific-rules) in templates except signal reads

### State Management

- **Signals**: Use for [synchronous state](#rxjs) management
- **RxJS**: Use for [asynchronous operations](#rxjs), always [unsubscribe](#rxjs) properly
- **Effects**: Use for [side effects](#rxjs) related to signal changes

### Naming & Organization

- **Component Naming**: End routing components with [`-view`](#general-file-structure) suffix
- **File Structure**: Place [related files](#general-file-structure) together in appropriate directories
- **Exports**: Use [`index.ts`](#general-file-structure) files to export from directories containing related files

### NX Workspace

- **Library Structure**: Create [buildable libraries](#nx-workspace) with clear import paths
- **Domain Separation**: Organize by [domain and purpose](#nx-workspace) (`domain`, `uikit`, `queries`, etc.)
- **Changesets**: Document changes with [clear, specific changeset messages](#changesets)

---

## `any` and `$any()`

- **Never** use `any` in TypeScript.
- **Never** use `$any()` in templates.
- Use `unknown` instead. If casting to a specific type is necessary, use a type assertion.

```ts
// ❌
const myVar: any = 'test';

// ✅
const myVar: unknown = 'test';

const isString = (value: unknown): value is string => typeof value === 'string';

if (isString(myVar)) {
  console.log(myVar); // is a string
}
```

## Private

- **Never** use `#` for private members.
- **Never** use `_` as a prefix for private members unless absolutely necessary (e.g. private component to component communication and unit testing).
- Use the `private` keyword for:
  - Internal methods and properties.
  - Dependency Injection (`inject`).
    - If the injected code is heavily used in a component template, the `private` modifier should be replaced with a `protected` modifier.

```ts
export class MyComponent {
  // ✅
  private zeroService = inject(ZeroService);

  // ❌
  _zeroService = inject(ZeroService);

  // ❌
  #zeroService = inject(ZeroService);
}
```

## Protected / Public / Static

- **Never** use `public` or `static` keywords.
- **Never** use `protected` unless absolutely necessary.

## Readonly

- Use the `readonly` keyword to declare constants where appropriate.

```ts
import { YOUTUBE } from "./constants";

let idCounter = 0;

export class MyComponent {
  // ✅
  readonly YOUTUBE = YOUTUBE;

  // ✅
  readonly ID = idCounter++;

  // ❌
  readonly mySignal = signal(false);

  // ❌
  readonly myInput = input(false);

  // ❌
  readonly myComputed = computed(() => {});

  // ❌
  readonly log() {
    console.log("test");
  }
}
```

## Inject

- Only use `inject` for full services and other tokens.
- **Never** use `inject` to inject explicit properties.

```ts
export class MyComponent {
  // ✅
  private myService = inject(MyService);

  // ❌
  private myMember = inject(MyService).myMember;
  private myOtherMember = inject(MyService).myOtherMember;
}
```

## Enums

- **Never** use TypeScript enums. Instead, use regular objects marked with `as const`.

```ts
// ❌
export enum NotificationType {
  Club = 'club',
  Sport = 'sport',
}

// ❌ (applies to const as well)
export const enum NotificationType {
  Club = 'club',
  Sport = 'sport',
}

// ✅
export const NOTIFICATION_TYPE = {
  CLUB: 'club',
  SPORT: 'sport',
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPE)[keyof typeof NOTIFICATION_TYPE];
```

## Formatting

- **Never** use **snake_case**.

```ts
// ❌
const my_const = true;
```

- Use **NormalCase** for class names (e.g., components, services, etc.).

```ts
// ✅
export class MyComponent {}
```

- Use **SCREAMING_CASE** for constants.
  - **Do not** use SCREAMING_CASE for variables declared inside functions.
  - **Do not** use SCREAMING_CASE for function names.

```ts
// ✅
const MY_CONST = true;

const myFunction = () => {
  // ✅
  const random = Math.random();

  // ❌
  const RANDOM = Math.random();
};

// ❌
const MY_FUNCTION = () => {};
```

- Use **camelCase** for everything else.

## Functions

- Use arrow functions for standalone functions.
- Use regular methods inside classes.
- **Do not** use arrow functions inside classes.
- **Do not** use the `function` keyword.
- Limit functions to a maximum of two parameters. Use an object parameter for more complex inputs.
- Ensure the function name clearly describes its purpose and behavior.

```ts
// ✅
const myFunction = () => {}

// ❌
function myFunction() {}

class MyClass {
  // ✅
  method() {}

  // ❌
  arrowMethod = () => {}
}

// ✅
const logMessage = (scope: string, message: string) => {}

// ❌
const logMessage = (scope: string, message: string, logLevel: string) => {}

// ✅
type MyFunctionWithParamsConfig = {
  scope: string;
  logLevel: string;
}

const logMessage = (message: string, config: MyFunctionWithParamsConfig) => {}

// ❌ The function name doesn't describe what it does
const onChange = () => {
  const formValue = myForm.getRawValue();

  sendToApi(formValue);
}

// ✅
const sendMyFormValueToApi() {
  const formValue = myForm.getRawValue();

  sendToApi(formValue);
}

```

## Variables

- **Never** use `var`.
- **Never** use `let` unless the variable needs to be reassigned.
- **Never** declare multiple variables using a single `let` or `const` statement.
- **Always** use `const` for variables that do not need to be reassigned.

```ts
// ❌
var myVar = 'test';

// ❌
let myVar = 'test';

// ✅
const myVar = 'test';

// ✅
let count = 0;

const add = () => {
  count++;
};

// ❌
const myVar1 = 'test',
  myVar2 = 'test';

// ✅
const myVar1 = 'test';
const myVar2 = 'test';
```

## Equality Checks

- **Never** use `==` or `!=`.
- Always use `===` or `!==`.

## Type / Interface

- **Never** use the `interface` keyword.
- Always use the `type` keyword instead.

## Generics

- **Never** use single-letter generics.
- Always use descriptive names for generics.
- Always start generic names with a capital `T` followed by a capitalized name.

```ts
// ❌
const myFunction = <T>(value: T) => {};

// ✅
const myFunction = <TValue>(value: TValue) => {};
```

## Async / Try-Catch

- **Never** use the `async` keyword. Instead, use RxJS for handling asynchronous operations.

```ts
const API_URL = 'https://api.example.com';

// ❌
const fetchData = async () => {
  try {
    const res = await fetch(API_URL);
    return await res.json();
  } catch (error) {
    console.log(error);
  }
};

// ✅
const data$ = from(fetch(API_URL)).pipe(switchMap((res) => from(res.json())));
```

## TypeScript Config

- Ensure `strict` is set to `true`.
- Ensure `noUncheckedIndexedAccess` is set to `true`.
- Keep the remaining defaults provided by NX
- Set `resolveJsonModule` to `true` only if necessary. JSON files should be fetched via HTTP requests.
- Set `esModuleInterop` to `true` only if necessary.

## RxJS

- Use RxJS for asynchronous operations.
- Avoid using `.subscribe()` within an observable pipe.
- Never use `.subscribe()` to extract data from an observable.
- Do not use RxJS to manage synchronous state—use signals instead.
- Use the dollar sign (`$`) to indicate observables.
- Always unsubscribe from observables when they are no longer needed. Use one of the following methods to ensure this:
  - The `takeUntilDestroyed()` operator (requires an injection context).
  - The `.unsubscribe()` method from the `Subscription` class returned by `subscribe()`.
  - Operators like `takeUntil`, `takeWhile`, or `take`.
  - **When using operators, always place them at the end of the pipe.**
- Keep the `subscribe()` call empty and use the `tap` operator to handle side effects.
- Avoid using RxJS within effects or computed values. This can lead to memory leaks and is likely not the best solution for the problem.

```ts
// ❌
const clickCount$ = new BehaviorSubject(0);

// ✅
const clickCount = signal(0);

// ❌
let data: string | null = null;

someObservable$.subscribe((res) => data = res);

// ✅
const data = toSignal(someObservable$);

// ❌
from(fetch(API_URL)).pipe(
  tap((res) => {
    // ❌ subscription inside a pipe
    from(res.json()).subscribe((data) => {
      // ❌ code inside the subscribe call
      console.log(data);
    });
  }),
).subscribe() // ❌ subscription made without unsubscribe logic

// ✅
from(fetch(API_URL))
  .pipe(
    // ✅ switching to the inner observable
    switchMap((res) => from(res.json())),
    // ✅ performing side effects via tap
    tap((data) => console.log(data)),
    // ✅ clean up once the e.g. component is destroyed
    // ✅ placed as the last operator inside the pipe
    takeUntilDestroyed(),
  )
  .subscribe();


// ❌ every time the page signal changes this effect will run and create a new subscription.
effect(() => {
  const page = myPageSignal();

  fetchFromMyApi(page).pipe(tap(res) => console.log(res)).subscribe();
})

// ✅
toObservable(myPageSignal)
  .pipe(
    switchMap((page) => fetchFromMyApi(page)),
    tap((res) => console.log(res)),
    takeUntilDestroyed(),
  )
  .subscribe();
```

## Components, Directives, Services & Pipes and other Angular specific rules

- Use `inject` for dependency injection.
- Avoid using function calls as value bindings inside Angular templates, except for signal reads.

```ts
export class MyComponent {
  buttonText = input.required<string>();

  betterIsButtonDisabled = computed(() => this.buttonText() === 'foo');

  isButtonDisabled() {
    return this.buttonText() === 'foo';
  }

  log() {
    console.log('this is fine');
  }
}
```

```html
<!-- ❌ This function will run on EVERY change detection cycle -->
<button [disabled]="isButtonDisabled()">Button</button>

<!-- ✅ This will update only if the computed value changes -->
<button [disabled]="betterIsButtonDisabled()">Button</button>

<!-- ✅ Event bindings are fine of cause -->
<button (click)="log()">Button</button>
```

- Avoid using native DOM APIs (e.g., `document.`, `window.`).
- Refrain from using native names for inputs and outputs, such as `title`, `change`, or `hidden`.
- Do not prefix outputs with `on`, such as `onSelectDate` or `onEnter`. Instead, use names like `selectDate` or `enter`.
- Avoid using outdated lifecycle hooks (`ngOnChanges`, `ngAfterViewInit`, `ngAfterContentInit`, etc.).
- Minimize the use of `ngOnInit` and `ngOnDestroy`. Prefer the `constructor`, as it runs within the injection context.
- Follow the example below to structure your code effectively.

```ts
export class MyComponent {
  // dependency injection first
  private myService = inject(MyService);

  // inputs
  myInput = input();

  // outputs
  myOutput = output();

  // private members
  private shouldDoStuff = computed(() => {});

  // public members
  readonly ICQ_LINK = ICQ;
  readonly MSN_LINK = MSN;

  computedStuff = computed(() => {});

  form = new FormGroup(...);

  stuff = useMyExternalUtilFunction();

  // constructor
  constructor(){
    effect(() => console.log(this.computedStuff()));

    // ngOnInit
    afterNextRender(() => console.log('init'));

    // ngOnDestroy
    inject(DestroyRef).onDestroy(() => console.log('cleanup'));
  }

  // lifecycle hooks (avoid if possible)

  // public methods
  greet() {
    console.log('hi mom');
  }

  // private methods
  private calculateGreeting() {}
}
```

### Components

- Always use `ChangeDetectionStrategy.OnPush` for better performance.
- Always use `ViewEncapsulation.None` for consistency.
- Stick to inline templates and styles for smaller components.
- Use external `.component.html` and `.component.css/scss` files for more complex components.

### Directives

- Avoid using common names for inputs and outputs. If common names are used, the directive may not be applicable to a component that already uses the same names for its inputs or outputs.
- With the new signal APIs, most directives can be replaced with utility functions. Consider moving the core logic into a simple function and using that function within the directive. This approach allows the logic to be reused without requiring the directive to be applied.

### Services

- In modern Angular, most services can be replaced with modular utility functions. Consider adopting this approach where possible.
- Use `providedIn: 'root'` only when absolutely necessary. Services should be provided at the point of use to ensure better modularity and control.

### Pipes

- Pipes should not contain logic. Instead, place the logic in a utility function. Nowadays, most pipes can be replaced by a simple utility function call within a `computed`.

### Guards

- Guards should not be used unless absolutely necessary. Most "guard cases" be handled within the component itself.

### Resolvers

- **Do not** use resolvers. Use the query library to fetch data.

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
