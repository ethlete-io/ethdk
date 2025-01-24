# Style Guide v0.2

This document outlines the coding style guide for Angular applications at Braune Digital.
**This guide is a work in progress and will be updated regularly.**

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
- **Never** use `_` as a prefix for private members.
- Use the `private` keyword for:
  - Internal methods and properties.
  - Dependency Injection (`inject`).
    - If the injected code is heavily used in a component template, the `private` modifier should be replaced with a `protected` modifier.

```ts
export class MyComponent {
  // ✅
  private seoService = inject(SeoService);

  // ❌
  _seoService = inject(SeoService);

  // ❌
  #seoService = inject(SeoService);
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

## Type / Interface

- **Never** use the `interface` keyword.
- Always use the `type` keyword instead.

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

## Components, Directives, Services & Pipes

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
    effect(() => console.log(this.computedStuff());

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
