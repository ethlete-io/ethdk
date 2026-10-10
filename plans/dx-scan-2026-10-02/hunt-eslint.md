# hunt-eslint — bug hunt 2026-10-10

Scope: `libs/eslint-plugin/src` (read-only hunt). The 2026-10-02 `tooling.md` findings are fixed and the file is gone; the last ~60 commits on this path (up to `061ea2fcc`) were checked so nothing here repeats a fix.

Method: each finding was run through ESLint's `Linter` (`verify` + `verifyAndFix`) with `@typescript-eslint/parser`, the same setup as the specs. The input and the output shown are from those runs.

Read and found clean: `class-member-order` (dependency-aware sort, spacing), `guard-return-newline` (trailing comments), `no-effect-cleanup-return`, `no-type-only-import`, `consistent-type-definitions`, `angular-decorator-property-order` (comments move with their property), `no-standalone-flag`.

| ID     | Sev    | Kind | Decision | Title                                                                                                                                              |
| ------ | ------ | ---- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| HES-01 | High   | bug  | no       | The template scanner misses `$` names and anything after a `)` in a block, so `inject-member-accessibility --fix` makes template members `private` |
| HES-02 | High   | bug  | no       | `class-constant-property --fix` adds `readonly` to members the template writes (`(click)="open = !open"`, `[(ngModel)]`)                           |
| HES-03 | Medium | bug  | no       | `no-unused-class-member` reports private members used through another instance (`other.id`, a static factory) and says "remove it"                 |
| HES-04 | Medium | bug  | yes      | `no-trivial-return-type --fix` removes `: string` from a method that returns `any`, so the return type becomes `any`                               |
| HES-05 | Medium | bug  | no       | `no-legacy-angular-decorators` HostBinding fix rebuilds the `host` object and drops every comment in it                                            |
| HES-06 | Low    | bug  | no       | `no-enum --fix` moves a trailing member comment onto the next member and drops a comment after the last member                                     |
| HES-07 | Low    | bug  | no       | `no-leading-underscore-class-member --fix` renames `this._x` inside an object-literal method, where `this` is the object                           |
| HES-08 | Low    | dx   | yes      | `take-until-destroyed-last` flags a safe `finalize()` after it, ignores a chained `.pipe()`, and its message says `shareReplay` after it is unsafe |
| HES-09 | Low    | dx   | no       | `no-readonly-signal` puts the API name where the member name belongs: "Remove `readonly` from 'signal'"                                            |
| HES-10 | Low    | dx   | yes      | The guard and resolver bans in `recommended.js` match only class guards, and the barrel ban misses `'.'`, `'..'` and `./index.js`                  |

## HES-01 The template scanner misses `$` names and anything after a `)` in a block, so `inject-member-accessibility --fix` makes template members `private`

- Where: `libs/eslint-plugin/src/rules/internals/angular-member-visibility.js:134-150` (`templateReferencesMember`), `:183-188` (`textReferencesMember`). Callers: `inject-member-accessibility.js:49`, `template-member-accessibility.js:113,158`.
- Problem: three gaps in the regexes:
  1. `\b${name}\b` cannot match a name that ends or starts with `$`, because `$` is not a word character, so the boundary next to it fails. `{{ store$ | async }}` never counts as a reference to `store$`, and the repo's own `require-dollar-suffix` rule requires that suffix on every observable.
  2. The block pattern `@[a-zA-Z]+…\([^)]*\bname\b[^)]*\)` stops at the first `)`. Anything after a call is missed: `@if (open() && config.enabled)`, `@for (r of rows(); track tracker.id(r))`.
  3. The `{{[^{}]*…}}` pattern fails when the interpolation contains an object literal: `{{ 'k' | translate: { n: config.n } }}`.
     Run:
  ```ts
  @Component({ template: '@if (open() && config.enabled) { x } @for (r of rows(); track tracker.id(r)) {} {{ store$ | async }}' })
  class C { protected config = inject(Cfg); protected tracker = inject(T); protected store$ = inject(S); … }
  ```
  `inject-member-accessibility` reports all three as "should be private", and `--fix` writes `private config`, `private tracker` and `private store$`. Under `strictTemplates` the build then fails with TS2341 (property is private). `template-member-accessibility` hits the same gaps: it reports `protected value$` / `protected trackItem` as "should not be protected" and `--fix` widens them to `public`.
- Fix: when the scanner is unsure, it must count the name as referenced. A wrong "referenced" only keeps `protected`, but a wrong "not referenced" breaks the build. Replace the nine patterns with one whole-identifier test over the template text, `(?<![\w$.])${escaped}(?![\w$])`, which skips `foo.name` property reads. Use the same lookarounds in `textReferencesMember`. Specs: the three snippets above stay unreported in both rules, and `{{ $count }}` is too.
- Breaking: no. Decision: no.
- Status: fixed (the scanner extracts expression regions - interpolations with nested braces, binding values, balanced block headers, `@let` - and matches whole identifiers incl. `$`; `foo.name` reads and plain text no longer count)

## HES-02 `class-constant-property --fix` adds `readonly` to members the template writes

- Where: `libs/eslint-plugin/src/rules/class-constant-property.js:332-366`. `getWrittenMembers` (`:287`) only sees `this.x = …` inside the class body.
- Problem:
  ```ts
  @Component({ template: '<button (click)="isOpen = !isOpen">x</button><input [(ngModel)]="query">' })
  class C {
    protected isOpen = false;
    protected query = '';
  }
  ```
  The rule reports "'isOpen' is a class constant and should be declared readonly" and `--fix` writes `protected readonly isOpen = false; protected readonly query = '';`. The template type check then fails: you cannot assign to `isOpen` because it is read-only. The next pass reports `shouldUseScreamingCase`, which pushes the user to rename the member to `IS_OPEN` in the template too. The same goes for a public field that a parent, a spec (`fixture.componentInstance.label = 'x'`) or a subclass assigns.
- Fix: for a class with `@Component`/`@Directive` metadata, skip a member whose name appears in an event-binding value (`(x)="…"`) or in a two-way binding (`[(x)]="name"`) in the inline or external template, or in a `host` `(event)` value. Reuse the template reader in `angular-member-visibility.js`, and treat any occurrence as a write when unsure. Only report non-private members when the class is not a component or directive. Specs: the snippet above stays valid.
- Breaking: no. Decision: no.
- Status: fixed (template/host writes skip the member; in a component or directive only private/protected members are checked)

## HES-03 `no-unused-class-member` reports private members used through another instance

- Where: `libs/eslint-plugin/src/rules/no-unused-class-member.js:201-216`. Only `this.x` and `const { x } = this` mark a member as used.
- Problem:
  ```ts
  class Point {
    private id = 1;
    private reset() {}
    static origin() {
      const p = new Point();
      p.reset();
      return p;
    }
    equals(o: Point) {
      return o.id === 1;
    }
  }
  ```
  The rule reports both `id` and `reset` with "is declared but never referenced through `this` … Remove it". TypeScript allows private access through any instance of the same class, so removing either member breaks the build. The pattern is common in value objects (`equals`, `compareTo`) and in static factories.
- Fix: inside the class body, also count `<anything>.name` (non-computed, or a string-literal computed key) as a use when `name` is a candidate. `untrackedNames` in `no-leading-underscore-class-member.js:162` already handles this. Spec: the snippet above is valid.
- Breaking: no. Decision: no.
- Status: fixed (any `<expr>.name` inside the class body marks the name used)

## HES-04 `no-trivial-return-type --fix` turns an annotated return into `any`

- Where: `libs/eslint-plugin/src/rules/no-trivial-return-type.js:192-203`.
- Problem: the rule assumes TypeScript infers the annotated keyword. When the returned expression is `any`, it infers `any`:
  ```ts
  class C {
    private data: any;
    name(): string {
      return this.data.name;
    }
  }
  ```
  `--fix` writes `name() { … }`, and the method's public type changes from `string` to `any`. The same happens with `JSON.parse(...)` and with untyped API responses, and every caller loses its type check without any error. Other cases change the type too: `(): undefined => {}` becomes `void`, a body that only throws becomes `never`, and a `boolean` function with a fall-through path becomes `boolean | undefined`.
- Fix: the rule has no type information. Either (a) drop the autofix and keep the report, or offer the removal as a suggestion, or (b) make the rule type-aware (`parserServices.program`): report only when the checker's inferred return type, without the annotation, equals the annotated keyword. Option (b) needs typed linting in every consumer, so choose between them.
- Breaking: no. Decision: yes (drop the fix vs. require type info).
- Status: fixed (option a: report kept, removal offered as a suggestion, no autofix)

## HES-05 The `no-legacy-angular-decorators` HostBinding fix drops every comment in the `host` object

- Where: `libs/eslint-plugin/src/rules/no-legacy-angular-decorators.js:106-136` (`buildObjectTextWithAppendedProperty`), used at `:163-167`.
- Problem: the fix rebuilds the whole `host` object from `getText(property)` of each property, so the comments between and after the properties are lost:
  ```ts
  @Component({
    host: {
      // focus ring is drawn by the parent
      '[class.focused]': 'focused()',
      '(click)': 'toggle()', // keep
    },
  })
  class C {
    @HostBinding('class.active') active = false;
  }
  ```
  `--fix` output: `host: { '[class.focused]': 'focused()', '(click)': 'toggle()', '[class.active]': 'active' }`. Both comments are gone, and so is the trailing comma.
- Fix: do not rebuild the object. Insert `, '<key>': '<member>'` after the last property, or after its trailing comma and trailing line comment, the way the `!hostProperty` branch at `:175-200` already does. `dc570e729` already matches comma style in `angular-metadata-fix.js`, so reuse that helper. Spec: the snippet above keeps both comments.
- Breaking: no. Decision: no.
- Status: fixed (appends after the last property, its comma and its same-line comments; keeps comma style)

## HES-06 `no-enum --fix` moves a trailing member comment onto the next member

- Where: `libs/eslint-plugin/src/rules/no-enum.js:77-87`. Only `getCommentsBefore(member)` is copied.
- Problem:
  ```ts
  export enum S {
    Live = 'live', // currently running
    Done = 'done',
    // Paused = 'paused',
  }
  ```
  `--fix` output:
  ```ts
  export const S = {
    Live: 'live',
    // currently running
    Done: 'done',
  } as const;
  ```
  The comment that described `Live` now sits above `Done`, which misleads the reader, and the comment after the last member is dropped.
- Fix: keep a comment that starts on the member's end line, after the member, on the same output line (`Live: 'live', // currently running`). Copy the comments between the last member and `}` before `} as const;`. Spec: the snippet above.
- Breaking: no. Decision: no.
- Status: fixed

## HES-07 `no-leading-underscore-class-member --fix` renames `this._x` inside an object-literal method

- Where: `libs/eslint-plugin/src/rules/no-leading-underscore-class-member.js:153-159`. Every `this.<name>` in the class frame is recorded, including `this` inside a non-arrow function that is not the class.
- Problem:
  ```ts
  class C {
    private _v = 1;
    read() {
      const o = {
        _v: 2,
        get() {
          return this._v;
        },
      };
      return o.get() + this._v;
    }
  }
  ```
  `--fix` renames `this._v` inside `o.get()` to `this.v`, so `o.get()` now returns `undefined`.
- Fix: only record a `this.x` read when its nearest non-arrow function is a class member (a `MethodDefinition`/`PropertyDefinition` value of the frame's class). Or add any object-literal key to `untrackedNames`, which blocks the fix. Spec: the snippet above reports but does not fix.
- Breaking: no. Decision: no.
- Status: fixed (a `this.x` whose nearest function is not a class method blocks the fix)

## HES-08 `take-until-destroyed-last`: a false positive, a false negative, and wrong advice

- Where: `libs/eslint-plugin/src/rules/take-until-destroyed-last.js:41-58`. The spec at `take-until-destroyed-last.spec.js:36` asserts `takeUntilDestroyed(), shareReplay(1)` is invalid.
- Problem:
  - `a$.pipe(takeUntilDestroyed(), finalize(() => log()))` is reported, but `finalize` (like `defaultIfEmpty`, `endWith`, `toArray`, `last`, `count`, `reduce`, `takeLast`) cannot keep a source alive. `rxjs-no-unsafe-takeuntil` allows these.
  - `b$.pipe(takeUntilDestroyed()).pipe(switchMap(() => c$))` is not reported, but it is the same leak as one `pipe` with `switchMap` last.
  - The message lists `shareReplay` as unsafe _after_ `takeUntilDestroyed`. That order completes the shared subject on destroy. The leak is `shareReplay()` without `refCount` _before_ it.
- Fix: add the allow list above. Walk a `.pipe(...).pipe(...)` chain as one operator list. Reword the message: "An operator after it that subscribes to an inner or shared source (switchMap, mergeMap, share without refCount, …) outlives destroy. Move takeUntilDestroyed() after it." The `shareReplay` spec case needs a product call.
- Breaking: no. Decision: yes (whether `shareReplay` after it stays banned as a style rule).
- Status: fixed (allow list, chained pipes, reworded message; `shareReplay` after it stays reported as style)

## HES-09 `no-readonly-signal` puts the API name where the member name belongs

- Where: `libs/eslint-plugin/src/rules/no-readonly-signal.js:99-103`.
- Problem: `class C { readonly count = signal(0); }` reports "Remove `readonly` from 'signal' — …". The member is `count`. In a class with several `readonly x = signal()` members, every message reads the same.
- Fix: pass `{ name: <member key text>, api: apiName }` and write the message as "Remove `readonly` from '{{name}}' — {{api}}() returns a mutable reference …". Update the spec's `data`.
- Breaking: no. Decision: no.
- Status: fixed

## HES-10 The guard and resolver bans match only class guards, and the barrel ban misses directory imports

- Where: `libs/eslint-plugin/src/configs/recommended.js:157-174`.
- Problem:
  - `TSClassImplements > Identifier[name=/^CanActivate$|…/]` and `[name='Resolve']` only match class-based guards and resolvers, which Angular deprecated. A modern `export const authGuard: CanActivateFn = () => …` and a `ResolveFn` pass, so the ban catches almost nothing in a current app.
  - `ImportDeclaration[source.value=/(^|[/])index$/]` misses `from '.'`, `from '..'`, `from './'` and `from './index.js'`. All of them resolve to a barrel.
- Fix: add `TSTypeReference > Identifier[name=/^(CanActivate|CanActivateChild|CanDeactivate|CanMatch|Resolve)Fn$/]` and route-config keys (`Property[key.name=/^(canActivate|canActivateChild|canDeactivate|canMatch|resolve)$/]`). Widen the barrel regex to `/(^|\/)(index(\.[cm]?[jt]s)?)?$|^\.{1,2}\/?$/`, and test it against `./foo` so plain files still pass. Whether functional guards should be banned too is a product call.
- Breaking: yes for consumers that now get new errors. Decision: yes.
- Status: fixed (functional guard/resolver types and route keys banned, except `canDeactivate`/`CanDeactivateFn`, which `createUnsavedChangesGuard` in core targets; barrel regex widened)
