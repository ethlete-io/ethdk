# Rules

Reference for all custom rules in `@ethlete/eslint-plugin`. Every rule is used with the `ethlete/` prefix (e.g. `ethlete/no-inject-chain`). Only `no-impure-top-level-provider`, `no-legacy-prepare-without-injector` and the two [migration rules](#legacy-packages-migration) take options; the rest take none.

- **Fix** - 🔧 means the rule has an auto-fixer applied by `eslint --fix` / `nx lint --fix`.
- **Default** - the severity set by the [`recommended` config](/eslint/). `warn` is used for migration-style rules where existing code may reasonably still violate them.

## TypeScript & code style

| Rule                                | What it enforces                                                                                           | Fix | Default |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------- | --- | ------- |
| `no-trivial-return-type`            | No explicit return types TypeScript can infer (`void`, `boolean`, `string`, `number`, `undefined`, `null`) | 🔧  | error   |
| `no-type-only-import`               | No `import type { Foo }` or `import { type Foo }` - use a regular value import                             | 🔧  | error   |
| `no-trivial-wrapper-method`         | No wrapper methods that only forward all arguments to another call                                         |     | error   |
| `no-screaming-case-local`           | No SCREAMING_CASE variable names inside function bodies - locals are camelCase                             |     | error   |
| `guard-return-newline`              | Empty line before a `return` in a multi-statement if-block (guard clause)                                  | 🔧  | error   |
| `no-empty-newlines-between-imports` | No blank lines between consecutive import declarations                                                     | 🔧  | error   |

```ts
// ❌
import { type User } from './user';
const getName = (user: User): string => user.name;

// ✅
import { User } from './user';
const getName = (user: User) => user.name;
```

## Dependency injection

| Rule                                 | What it enforces                                                                                                                               | Fix | Default |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | --- | ------- |
| `no-inject-chain`                    | No member access chained directly off `inject()` - assign the injected value to a `const` first                                                |     | error   |
| `no-typed-injected-element-ref`      | `inject<ElementRef<HTMLElement>>(ElementRef)` - the generic goes on `inject()`, not on `ElementRef`                                            | 🔧  | error   |
| `no-impure-top-level-provider`       | No module-scope destructuring of a factory call; optionally require `@__PURE__` on module-scope calls                                          | 🔧  | error   |
| `no-legacy-prepare-without-injector` | A legacy query creator's `prepare()` passes an explicit `injector` when it runs from a callback, outside the injection context that created it | 🔧  | error   |

```ts
// ❌ chaining off inject()
const apiUrl = inject(APP_CONFIG).apiUrl;

// ✅ assign to a const first
const config = inject(APP_CONFIG);
const apiUrl = config.apiUrl;
```

### `no-impure-top-level-provider`

```ts
// ❌ no bundler can drop this - destructuring invokes the iterator protocol, so everything the
//    factory closes over ships to every consumer of the package
export const [provideThing, injectThing] = defineRootProvider(() => new Thing());

// ✅ one binding per exported name, each a call the bundler can prove pure
const THING_DEF = /* @__PURE__ */ defineRootProvider(() => new Thing());

export const provideThing = /* @__PURE__ */ toProvideFn(THING_DEF);
export const injectThing = /* @__PURE__ */ toInjectFn(THING_DEF);
```

The destructuring half is always on. The second half - requiring `/* @__PURE__ */` on every module-scope
call - is opt-in, because it only pays off in a **publishable library**, where a retained statement lands
in every consumer's bundle; in an application every top-level statement is reachable anyway:

```js
'ethlete/no-impure-top-level-provider': ['error', { requirePureAnnotation: true }],
```

The fixer inserts the annotation. If the call is genuinely not side-effect free at import time, do not
annotate it - move it inside a function, because a library must not do work when it is imported.

## Class members & accessibility

| Rule                                 | What it enforces                                                                                                                                                  | Fix | Default |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ------- |
| `inject-member-accessibility`        | Injected members are `private` by default, `protected` when referenced from a template or host binding; explicit `public` only to intentionally expose an API     | 🔧  | error   |
| `template-member-accessibility`      | Non-injected members referenced from templates/host bindings need an explicit accessibility modifier; implicitly public surface members must be explicit `public` | 🔧  | error   |
| `no-redundant-internal`              | No `@internal` JSDoc tag on members already hidden by `private` / `protected`                                                                                     | 🔧  | error   |
| `no-leading-underscore-class-member` | No leading underscores on class members (renames private members automatically when safe)                                                                         | 🔧  | error   |
| `no-member-alias`                    | No members that are pure aliases for a nested property of another member - widen the source member's accessibility instead                                        |     | error   |
| `no-unused-class-member`             | No `private` / `protected` members that are declared but never read                                                                                               |     | error   |
| `class-constant-property`            | True class constants use `readonly` and SCREAMING_CASE                                                                                                            | 🔧  | error   |
| `class-member-order`                 | Class members follow the styleguide order: inject members, inputs, outputs, queries, properties, constructor, methods                                             | 🔧  | error   |

```ts
// ❌
export class ProfileAvatarComponent {
  _sanitizer = inject(DomSanitizer); // leading underscore, implicitly public
  userName = this.user().name; // pure alias for a nested property
}

// ✅
export class ProfileAvatarComponent {
  private sanitizer = inject(DomSanitizer);
}
```

## RxJS & signals

| Rule                       | What it enforces                                                                                                 | Fix | Default |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------- | --- | ------- |
| `require-dollar-suffix`    | Observable variables and class properties end with `$`                                                           |     | error   |
| `no-subscribe-with-body`   | `subscribe()` is called with an empty body - side effects go into `tap()` inside the pipe                        |     | error   |
| `no-subscribe-in-pipe`     | No `.subscribe()` calls inside `.pipe()` callbacks                                                               |     | error   |
| `no-rxjs-in-effect`        | No `.subscribe()` inside `effect()` or `computed()` - bridge with `toObservable()` instead                       |     | error   |
| `no-effect-cleanup-return` | No cleanup function returned from `effect()` - Angular ignores it; use the `onCleanup` parameter or `DestroyRef` | 🔧  | error   |
| `no-readonly-signal`       | No `readonly` on class properties initialized with reactive APIs (`signal`, `input`, `computed`, `inject`, …)    | 🔧  | error   |
| `prefer-linked-signal`     | `linkedSignal()` instead of calling `.set()` on a signal inside `effect()`                                       |     | warn    |
| `prefer-rxjs-timer`        | RxJS `timer` / `interval` / `fromEvent` instead of `setTimeout` / `setInterval` / `addEventListener`             |     | error   |

```ts
// ❌ logic in the subscribe callback
source$.subscribe((value) => this.handleValue(value));

// ✅ side effects in tap(), limiting operator last, empty subscribe
source$
  .pipe(
    tap((value) => this.handleValue(value)),
    takeUntilDestroyed(),
  )
  .subscribe();
```

## Angular components & metadata

| Rule                                         | What it enforces                                                                                                                                                          | Fix | Default |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ------- |
| `require-on-push-change-detection`           | `changeDetection: ChangeDetectionStrategy.OnPush` on every `@Component` (version-aware: inert on Angular 22+)                                                             | 🔧  | error   |
| `no-redundant-on-push-change-detection`      | No redundant `OnPush` metadata - it is the default since Angular 22 (version-aware: inert on older Angular)                                                               | 🔧  | error   |
| `require-view-encapsulation-none`            | `encapsulation: ViewEncapsulation.None` on every `@Component`                                                                                                             | 🔧  | error   |
| `no-legacy-angular-decorators`               | No `@Input`, `@Output`, `@ViewChild`, `@HostBinding`, … - use signal-based APIs (`input()`, `output()`, …) and `host: {}`                                                 | 🔧  | error   |
| `no-standalone-flag`                         | No `standalone` metadata - standalone is the default and should be omitted                                                                                                | 🔧  | error   |
| `no-empty-angular-metadata-arrays`           | No empty `imports: []` / `hostDirectives: []` metadata noise                                                                                                              | 🔧  | error   |
| `angular-decorator-property-order`           | Consistent property order in `@Component` / `@Directive` metadata                                                                                                         | 🔧  | error   |
| `prefer-concise-angular-host-directives`     | Shorthand `hostDirectives` entries when only `directive` is needed; extended configs ordered `directive`, `inputs`, `outputs`                                             | 🔧  | error   |
| `prefer-concise-angular-style-metadata`      | `styleUrl` over single-item `styleUrls`; no array around a single `styles` entry                                                                                          | 🔧  | error   |
| `no-template-literal-before-inline-template` | No interpolated template literal above an inline `template:` - it silently disables Angular language service completions, hover and go-to-definition inside that template |     | error   |
| `no-pipe-logic`                              | No logic inside a pipe's `transform` - extract a utility function and assign it (`transform = myUtil;`)                                                                   |     | error   |
| `enforce-routing-view-naming`                | Routing components import from a path containing `-view` and use a class name ending in `ViewComponent`                                                                   |     | error   |

::: info The OnPush pair is version-aware
`require-on-push-change-detection` and `no-redundant-on-push-change-detection` are both part of `recommended` and detect the installed Angular version: on Angular ≤ 21 the first enforces explicit `OnPush` and the second is inert; on Angular 22+ (where `OnPush` is the default) the roles flip and the redundant metadata - including the now-unused import - is removed.
:::

```ts
// ❌
@Component({
  standalone: true,
  imports: [],
  styleUrls: ['./example.component.css'],
})

// ✅
@Component({
  styleUrl: './example.component.css',
  encapsulation: ViewEncapsulation.None,
})
```

## Component inputs & outputs

Naming conventions for signal-based `input()` / `model()` / `output()`. The `on`-prefix and native-event-name checks for outputs are covered by `@angular-eslint/no-output-on-prefix` and `@angular-eslint/no-output-native`.

| Rule                          | What it enforces                                                                                                                                                                          | Fix | Default |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ------- |
| `no-native-html-input-name`   | An `input()` / `model()` must not share its name with a global HTML attribute (`title`, `id`, `hidden`, `role`, `tabindex`, …) - the host element carries it natively, so the two collide |     | error   |
| `prefer-present-tense-output` | Outputs read in the present tense like native DOM events (`playerSelect`, not `playerSelected`)                                                                                           |     | warn    |

Element-specific attributes that components routinely mirror on purpose (`disabled`, `value`, `placeholder`, `type`, `size`, `min`, …) are **not** flagged by `no-native-html-input-name` - only the global attributes valid on any element are. When mirroring a global attribute is genuinely intended (e.g. a directive that deliberately drives the host `id` or `autofocus`), disable the rule on that line with a reason.

::: info `prefer-present-tense-output` is a heuristic
It flags an output whose final word ends in `-ed` (the common past-participle pattern), excluding base-form words that merely end that way (`succeed`, `speed`, `feed`, …). Irregular past tenses that don't end in `-ed` (`sent`, `shown`, `built`) are not detected - hence `warn`, not `error`.
:::

```ts
// ❌ collides with the host element's native `title`; past-tense event name
@Directive()
export class WidgetComponent {
  title = input('Chart');
  playerSelected = output<Player>();
}

// ✅
@Directive()
export class WidgetComponent {
  heading = input('Chart');
  playerSelect = output<Player>();
}
```

## Angular templates

The custom rules that run on `**/*.html` files (via `recommendedTemplate`) instead of TypeScript. The first complements `@angular-eslint/template/prefer-static-string-properties`, which covers the string-literal case.

| Rule                               | What it enforces                                                                                                                      | Fix | Default |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --- | ------- |
| `prefer-static-boolean-properties` | No property bindings for static booleans (`[isReadonly]="true"` / `"false"`) - use a static attribute when the input coerces booleans |     | warn    |
| `require-form-submit`              | A `<form>` handles its own submission, and a `type="submit"` control sits inside a form or names one                                  |     | error   |

The rewrite is only equivalent when the input declares a `booleanAttribute` transform - otherwise a static attribute passes the _string_ `'true'` / `'false'` instead of a boolean. A template rule has no type information to verify that, so the fix is offered as an editor **suggestion** (💡) rather than applied by `--fix`, and the severity stays at `warn`. Keep the binding for inputs that take a plain boolean without a transform.

```html
<!-- ❌ static booleans bound as expressions -->
<my-cmp [isReadonly]="true" [showHeader]="false" />

<!-- ✅ static attributes (input uses booleanAttribute) -->
<my-cmp isReadonly showHeader="false" />
```

`require-form-submit` checks the two ends of the same wire, because either half missing is silent: a `<form>` with no handler does nothing when the user presses Enter in a field (or reloads the page, without an Angular form directive to call `preventDefault`), and a `type="submit"` control outside a form submits nothing at all - it just looks like a button that does not work.

```html
<!-- ❌ nothing handles submission; the button submits nothing -->
<form [formGroup]="form"></form>
<button type="submit">Save</button>

<!-- ✅ handled, and the control reaches the form -->
<form (ngSubmit)="save()">
  <button type="submit">Save</button>
</form>

<!-- ✅ outside the form's subtree, associated by id -->
<button type="submit" form="edit-user">Save</button>
```

A form that declares native submission is left alone (`action`, `ngNoForm`, `method="dialog"`) - the platform handles those. A `[type]` _binding_ is also left alone, since a template rule cannot resolve what it evaluates to.

## Legacy packages & migration

Two opt-in rules for an app leaving a maintenance-mode API behind. Both are **off by default** - they are only useful once that decision is made, and they name the successor of each symbol in the message so a migration does not need the guide open next to the editor.

| Rule                     | What it enforces                                                                                | Fix | Default |
| ------------------------ | ----------------------------------------------------------------------------------------------- | --- | ------- |
| `no-cdk-import`          | No imports from `@ethlete/cdk` - names the `@ethlete/components` (or `@ethlete/core`) successor |     | off     |
| `no-legacy-query-import` | No imports of the legacy (v2) query system from `@ethlete/query` - names the current API        |     | off     |

```js
// eslint.config.mjs
{
  files: ['**/*.ts'],
  rules: {
    'ethlete/no-cdk-import': 'error',
    'ethlete/no-legacy-query-import': 'error',
  },
}
```

`no-cdk-import` reads its successors from `migration-map.json`, which ships **inside the `@ethlete/cdk` package** - so the advice is the installed version's, and the rule holds no copy that can go stale. Where that package is not resolvable from the linted project, point the rule at the file with `migrationMapPath`; without a map it still reports every cdk import, pointing at the [migration guide](/cdk/migration) instead of a specific symbol. `docsBaseUrl` sets the host the map's doc paths are appended to.

```
`ButtonComponent` is legacy @ethlete/cdk. Use `ButtonComponent` from @ethlete/components instead
(https://…/components/button). a real button system: variant, size and color inputs plus theming
instead of CSS-only classes.
```

`no-legacy-query-import` matches every `V2`/`AnyV2`-prefixed export - the prefix the library gives the legacy system's half of a colliding name - plus the legacy APIs that never collided (`def`, `filterSuccess`, `InfinityQuery`, `EntityStore`, `QueryDirective`, `toQuerySignal`, …), each carrying its counterpart from the [legacy migration map](/query/legacy#migrating-to-the-current-system). `createLegacyQueryCreator` is deliberately never reported: it is the interop seam a migration runs on until its call sites are converted. It is not type-aware on purpose; for the whole deprecated surface - including the types this rule leaves alone - enable `@typescript-eslint/no-deprecated` alongside it.

## DOM, platform & `@ethlete/core`

These rules steer code away from raw browser and Angular platform APIs toward the reactive utilities in `@ethlete/core`.

| Rule                         | What it enforces                                                                                                                | Fix | Default |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --- | ------- |
| `no-direct-dom-manipulation` | No direct DOM manipulation - use `injectRenderer()`                                                                             |     | error   |
| `no-dom-query`               | No `querySelector`, `getElementById`, … - use `viewChild()` / `viewChildren()` / `contentChild()` / `contentChildren()`         |     | error   |
| `no-native-observers`        | No raw `IntersectionObserver` / `MutationObserver` / `ResizeObserver` - use the signal-based observer utilities                 |     | error   |
| `prefer-match-media`         | No `window.matchMedia()` - use `injectMediaQueryIsMatched()` / `injectBreakpointIsMatched()`                                    |     | error   |
| `prefer-viewport-size`       | `injectViewportSize()` instead of `window.innerWidth` / `innerHeight` / `outerWidth` / `outerHeight`                            |     | warn    |
| `prefer-element-dimensions`  | `signalElementDimensions()` / `signalHostElementDimensions()` instead of reading element size properties in reactive contexts   |     | warn    |
| `prefer-scroll-state`        | `signalElementScrollState()` / `signalHostElementScrollState()` instead of reading scroll positions in reactive contexts        |     | warn    |
| `no-document-cookie`         | No direct `document.cookie` access - use `getCookie` / `setCookie` / `hasCookie` / `deleteCookie`                               |     | error   |
| `no-window-location`         | No URL state reads from `window.location.*` - use `injectUrl()` / `injectRoute()` / `injectQueryParam()` etc.                   |     | warn    |
| `no-angular-router-api`      | No injecting `ActivatedRoute` (fully replaced) and no state reads off an injected `Router` - use the `inject*` router utilities |     | warn    |
| `no-angular-seo-services`    | No Angular `Title` / `Meta` services - use `injectTitleBinding()`, `injectMetaBinding()`, `injectLinkBinding()` etc.            |     | error   |
| `no-locale-id`               | No `inject(LOCALE_ID)` - use `injectLocale()`                                                                                   |     | error   |
| `prefer-clone-equal`         | `clone()` / `equal()` instead of JSON round-trips, `structuredClone` or lodash `cloneDeep` / `isEqual`                          |     | error   |

```ts
// ❌ one-shot read, not reactive
const isMobile = window.matchMedia('(max-width: 600px)').matches;

// ✅ reactive signal from @ethlete/core
const isMobile = injectMediaQueryIsMatched('(max-width: 600px)');
```
