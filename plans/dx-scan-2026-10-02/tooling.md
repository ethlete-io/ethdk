# tooling — DX scan 2026-10-02

Scope: `libs/cli`, `libs/eslint-plugin`, `libs/agent-rules`

| ID      | Sev    | Kind     | Decision | Title                                                                                                                                 |
| ------- | ------ | -------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| TOOL-01 | High   | bug      | no       | `et release` creates the git tags before the release commit, so every tag points one commit back                                      |
| TOOL-02 | High   | dx       | yes      | `no-trivial-wrapper-method` flags encapsulating methods on stores/services                                                            |
| TOOL-03 | Medium | dx       | yes      | `recommendedTs` is documented for NestJS/Node projects but bans the things they need                                                  |
| TOOL-04 | Medium | dx       | no       | `recommendedSpec` covers only `*.spec.ts` and too few rules; every in-repo project works around it                                    |
| TOOL-05 | Medium | dx       | no       | A non-abstract base `@Directive` gets its `protected` members flagged by two rules with no way out in the message                     |
| TOOL-06 | Medium | dx       | no       | `require-dollar-suffix` has no fixer, though the rename is as mechanical as the one `no-leading-underscore-class-member` already does |
| TOOL-07 | Medium | dx       | no       | `ethlete-agents` ignores unknown flags, so a typo in `--dry-run` writes for real                                                      |
| TOOL-08 | Medium | dx       | no       | Default `lintCommand` / `storybookStartCommand` ignore the detected package manager, and `init` names no var                          |
| TOOL-09 | Low    | bug      | no       | `no-type-only-import` prints a wrong replacement for default, namespace and aliased imports                                           |
| TOOL-10 | Low    | dx       | no       | A broken `ethlete-agents.config.json` fails with a bare JSON `SyntaxError` and no file name                                           |
| TOOL-11 | Low    | dx       | no       | `et release --help` starts a release; `et release` hard-codes `yarn`                                                                  |
| TOOL-12 | Low    | dx       | no       | `ethlete-agents check` and the registry errors of `et update` name no fix that fits the repo                                          |
| TOOL-13 | Low    | test-gap | no       | `et release` has no spec for its step order                                                                                           |

## TOOL-01 `et release` creates the git tags before the release commit

- Where: `libs/cli/src/lib/release.ts:78-91` (and the documented order in `apps/docs/cli/index.md:24-25`)
- Problem: the sequence is `changeset version` → `changeset git-tag` (or `tag`) → `git add` → `git commit -m "Release versions"` → `git push --follow-tags`. Changesets tags `HEAD` (`node_modules/@changesets/cli/dist/git-tag.mjs`), and `HEAD` at that point is the commit _before_ the version bump. So `git checkout @scope/pkg@1.2.0` gives a tree whose `package.json` still says the old version and has no changelog entry, and a GitHub release built from the tag diffs against the wrong commit. If `git commit` fails (a pre-commit hook, or a commitlint `commit-msg` hook rejecting `Release versions`, which is not `type(scope): Subject`), the tags already exist locally. A rerun then finds them via `splitByTagStatus`, skips them, and the developer cannot tell that the tags were never moved. Changesets' own guidance is commit first, then tag.
- Fix: reorder to version → stage → commit → `changeset git-tag`/`tag` → push. If the commit fails, print which step failed and that no tag was written. Consider a configurable commit message, or one that passes commitlint (`chore(release): Release versions`) when a commitlint config is found (agent-rules already detects one in `libs/agent-rules/src/lib/commitlint.ts`). Update `apps/docs/cli/index.md` steps 4-5.
- Breaking: no. Decision: no.
- Status: fixed: commit before `changeset tag`; a failed commit stops with no tag and names the finishing commands; `--message` for commitlint hooks.
- Review: fixed the cli changeset (now major, with a breaking note for the `release()` signature).

## TOOL-02 `no-trivial-wrapper-method` flags encapsulating methods on stores/services

- Where: `libs/eslint-plugin/src/rules/no-trivial-wrapper-method.js:110-141`
- Problem: the rule ignores accessibility. It flags any method whose body forwards all its arguments, even when the target is private and the method _is_ the public API. Verified with the Linter:
  ```ts
  export class CartStore {
    private items = signal<string[]>([]);
    private cache = new Map<string, number>();
    setItems(items: string[]) {
      this.items.set(items);
    } // reported
    get(key: string) {
      return this.cache.get(key);
    } // reported
  }
  ```
  The message says "call 'this.items.set' directly at each call site", which a caller outside the class cannot do without making the writable signal public. That is the opposite of the read-only-signal-plus-setter pattern the reactive-state guidance pushes. Because it is `error` in `recommended`, consumers will either disable it inline or expose internals.
- Fix: skip the report when the method is public (or implicitly public) and the callee's receiver is a `private`/`protected`/`#` member of the same class (`this.<member>.x(...)`, where `<member>` is declared non-public). Or limit the rule to `private`/`protected` methods. Add specs for both cases. Pick one of the two scopes.
- Breaking: no. Decision: yes (which scope).
- Status: fixed: no report when the method is more visible than the `this.<member>` it calls through (incl. `#` and parameter properties); message updated.
- Review: fixed the `receiverVisibility` JSDoc description (internal, deleted); tightened the eslint-plugin changeset.

## TOOL-03 `recommendedTs` is documented for NestJS/Node projects but bans the things they need

- Where: `apps/docs/eslint/index.md` (the "Bring your own base config" warning: "A non-Angular project (NestJS, Node tooling) uses `recommendedTs` and `recommendedSpec` alone"); `libs/eslint-plugin/src/configs/recommended.js:130-150` (constructor injection, `@Injectable`), `:206` (`no-async-await`), `:180-189` (`window`/`document` globals)
- Problem: verified on a minimal Nest service. `@Injectable() class CatsService { constructor(private readonly repo: Repo) {} async findAll() { return await this.repo.find(); } }` gets four errors: "No @Injectable … use defineRootProvider from @ethlete/core", "No constructor injection. Use inject()", and two `no-async-await`. NestJS cannot work without any of the three. A developer who follows the doc gets a config they have to take apart rule by rule.
- Fix: move the Angular-only bans (the `@Injectable`/route guard/resolver/lifecycle/constructor-injection selectors, `no-restricted-globals`, the `@ethlete/core`-replacement rules) out of `recommendedTs` into `recommendedAngularTs`, or ship a separate `recommendedNode` config. Then correct the doc sentence. If neither is wanted, delete the NestJS claim from the docs.
- Breaking: yes (moving rules between configs changes what `recommendedTs` alone enforces). Decision: yes.
- Status: fixed (docs only): `apps/docs/eslint/index.md` drops the NestJS claim and shows which `no-restricted-syntax` selectors and `no-async-await` to turn off (verified with the Linter).
- Review: ok

## TOOL-04 `recommendedSpec` covers only `*.spec.ts` and too few rules

- Where: `libs/eslint-plugin/src/configs/recommended.js:394-411`
- Problem: the relaxation matches only `**/*.spec.ts`. `*.test.ts`, `testing/` harness folders, `*.stories.ts` and Playwright `e2e/**` files get the full app ruleset. Inside specs it still enforces `prefer-rxjs-timer` (a `setTimeout` in a test), `no-subscribe-with-body` (`obs$.subscribe((v) => values.push(v))` is the usual way to collect emissions), `prefer-clone-equal`, `max-params` and the `FunctionDeclaration` ban. Every project in this repo that lints with the plugin works around this by dropping specs from the main block: `apps/csp/eslint.config.mjs:12`, `apps/timetrack/eslint.config.mjs:13`, `apps/ethlete-studio/eslint.config.mjs:13`, `libs/components/eslint.config.mjs:37,68,88` (stories and `testing/**` too). A consumer has to find that out alone.
- Fix: widen `files` to `['**/*.spec.ts', '**/*.test.ts', '**/testing/**/*.ts', '**/*.stories.ts', '**/e2e/**/*.ts']` (stories maybe as their own entry), and also turn off `prefer-rxjs-timer`, `no-subscribe-with-body`, `no-subscribe-in-pipe`, `prefer-clone-equal`, `no-unused-class-member` and `max-params` there. Then drop the in-repo workarounds that become redundant, and document the globs in `apps/docs/eslint/index.md`.
- Breaking: no (it only relaxes). Decision: no.
- Status: fixed: `recommendedSpec` covers `*.test.ts`, `testing/**`, `*.stories.ts`, `e2e/**` and turns off the six rules. In-repo `ignores` workarounds left in place (outside the tooling scope; still correct).
- Review: ok

## TOOL-05 A non-abstract base `@Directive` gets its `protected` members flagged by two rules

- Where: `libs/eslint-plugin/src/rules/no-unused-class-member.js:153-159`; `libs/eslint-plugin/src/rules/template-member-accessibility.js`
- Problem: `@Directive({ selector: '[base]' }) export class BaseDirective { protected label = 'x'; }` is subclassed in another file, where the subclass, or a component extending it, reads `label`. It gets `no-unused-class-member` ("never read … widen its accessibility") and `template-member-accessibility` ("should not be protected"). Following either message breaks the subclass: `private` hides the member from it, and widening makes it public API. The only exemption is `abstract` (`frame.isAbstract`, line 153), and neither message mentions it.
- Fix: add "if this is a base class meant to be extended, mark it `abstract`" to both messages. Optionally also skip `protected` members of an _exported_ non-abstract `@Directive`, since a subclass in another file is the only reader `protected` allows there. Add a spec.
- Breaking: no. Decision: no.
- Status: fixed: both messages name `abstract`; `template-member-accessibility` now actually skips `protected` members of an abstract class (it did not before, so the hint would have been false).
- Review: ok

## TOOL-06 `require-dollar-suffix` has no fixer

- Where: `libs/eslint-plugin/src/rules/require-dollar-suffix.js:86-128`
- Problem: the rule is `error` in `recommended` and has no `fixable`, so turning the plugin on in an existing app means renaming every observable by hand. The rename is mechanical: for a local `const`, `context.sourceCode.getDeclaredVariables(node)` gives every reference. For a `private` class property, the same `this.<name>` scan that `no-leading-underscore-class-member.js:100-124` already uses for its own safe rename works. The AGENTS rule tells agents to run `--fix` "first (case, ordering, $ suffix, …)", so the generated guidance already promises a `$` fixer that does not exist.
- Fix: add a fixer for local variables (every reference in scope, skipping when the name with `$` is already taken or a reference is a shorthand property) and for `private` properties (every `this.x` in the class body). Leave public/protected members unfixed, since a template may read them. Specs for each case, plus a docs row update (`Fix` column).
- Breaking: no. Decision: no.
- Status: fixed (no fixer, per decision): the agent-rules `lint-and-format` rule and `styleguide` skill no longer claim `--fix` renames to `$`; synced.
- Review: ok

## TOOL-07 `ethlete-agents` ignores unknown flags

- Where: `libs/agent-rules/src/index.ts:76-100`
- Problem: flags are read with `argv.includes('--dry-run')` and `readFlag`. Anything else is dropped without a word. `npx ethlete-agents sync --dryrun` or `sync --dry` rewrites `AGENTS.md`, `.claude/`, `.agents/` and the hooks instead of previewing. `sync --target claude` (singular) syncs every target. An unknown subcommand prints the usage, but an unknown flag never does. `et update` already does this properly (`libs/cli/src/lib/update/args.ts:105-108`: "Unknown flag …", one report for all problems).
- Fix: parse the argv for `sync`/`check`/`init`/`migrate` against a known flag list (`--targets`, `--root`, `--dry-run`, `--help`). Print `Unknown flag "<flag>".` plus the usage and exit 1 before doing anything. Add a spec.
- Breaking: no. Decision: no.
- Status: fixed: `sync`/`check`/`init`/`migrate` parse flags against a per-command list and exit 1 with the usage on an unknown flag or stray argument.
- Review: fixed (deleted the internal `parseCommandArgs` JSDoc).

## TOOL-08 Default `lintCommand` / `storybookStartCommand` ignore the detected package manager, and `init` names no var

- Where: `libs/agent-rules/content/defaults.json:2-6`; `libs/agent-rules/src/lib/config.ts:194-200`; `libs/agent-rules/src/index.ts:56-73`
- Problem: `packageRunner` is detected from `packageManager`/lockfile (`package-runner.ts`), but `lintCommand` defaults to `npm run lint`, `lintFixCommand` to `npm run lint -- --fix` and `storybookStartCommand` to `npm run storybook`, whatever the repo uses. An Nx consumer usually has no `lint` script at all, so every agent in that repo is told to run a command that fails, and nothing warns. `init` writes `"vars": {}` and says "Fill in vars for your repo" without naming a single var or its current default.
- Fix: derive the defaults. Use `<runner> nx affected -t lint` / `nx lint <project>` when `nx` is installed. Otherwise use `<pm> run lint` only when `scripts.lint` exists, and the same for storybook. Make `init` pre-fill `vars` with the derived values (so the user edits instead of guesses), and have `sync` print one `warn` line when a var falls back to a default that names a missing script.
- Breaking: no (generated output changes, which is a normal sync diff). Decision: no.
- Status: fixed: lint/storybook vars derive from the repo `lint`/`storybook` scripts, else `nx lint <project>`; `init` pre-fills `vars`; `sync` warns when a lint var names a missing `<pm> run` script.
- Review: fixed `detectCommandVars` running once per var in `init()`; deleted internal JSDoc descriptions.

## TOOL-09 `no-type-only-import` prints a wrong replacement

- Where: `libs/eslint-plugin/src/rules/no-type-only-import.js:26-31`
- Problem: the suggested import in the message is built from `s.local.name` inside braces for every specifier kind. Verified: `import type Foo from 'foo'` reports "Use … `import { Foo } from 'foo'`" (a default import is not a named one). `import type * as ns from 'x'` reports `import { ns }`. `import type { A as B } from 'bar'` reports `import { B } from 'bar'`, which drops the alias. The fixer itself only removes `type` and is correct, so the message is the only thing that is wrong.
- Fix: build the text from the declaration's source with the `type` token removed (`sourceCode.getText(node)` minus the token range), or render default/namespace/aliased specifiers properly as the inline-specifier branch already does (lines 52-58). Add specs.
- Breaking: no. Decision: no.
- Status: fixed: message renders default, namespace and aliased specifiers.
- Review: fixed the `renderValueImport` JSDoc description (internal, deleted).

## TOOL-10 A broken `ethlete-agents.config.json` fails with a bare `SyntaxError`

- Where: `libs/agent-rules/src/lib/config.ts:75-81`
- Problem: `JSON.parse` throws straight up to `index.ts:113`, which prints e.g. `Expected ',' or '}' after property value in JSON at position 214`. It names no file, so with two config files (plus `ethlete.config.local.json`) the developer has to guess which one is broken. Unknown top-level keys (`exlude`, `hook`) are accepted without a word, unlike the local config, which reports `unknownKeys` (`config.ts:138-143`).
- Fix: wrap the parse in a try/catch and rethrow as `ethlete-agents.config.json: <message>`. Warn about unknown top-level keys through `plan.warnings`, the same way the local config does. Also warn about an `exclude` entry that matches no content name, since a typo there leaves the skill in place without a word.
- Breaking: no. Decision: no.
- Status: fixed: parse errors are prefixed with the file name; unknown top-level keys warn. (Unknown `exclude` names already warned.)
- Review: ok

## TOOL-11 `et release --help` starts a release; `et release` hard-codes `yarn`

- Where: `libs/cli/src/index.ts:73-78`; `libs/cli/src/lib/release.ts:9,16,80`
- Problem: every other subcommand handles `--help`, but `release` ignores everything except `--force`/`--skip-push`. `et release --help` goes straight to the clean-tree check and the "Press enter to continue" prompt, and Enter runs `changeset version`. The command also always shells out to `yarn changeset …`, while the rest of the CLI resolves the package manager (`invocation.ts`, `update/package-manager.ts`). An npm or pnpm repo gets `yarn: command not found` as a raw `execSync` error after the prompt.
- Fix: give `release` a usage text and reject unknown flags, like `parseUpdateArgs`. Run changesets through the detected package manager (`detectPackageManager` from `update/package-manager.ts`), and check that `@changesets/cli` is installed before the prompt, with a one-line hint if it is not.
- Breaking: no. Decision: no.
- Status: fixed: `release --help`, unknown-flag rejection, package-manager detection, and a `@changesets/cli` presence check before the prompt.
- Review: ok

## TOOL-12 `ethlete-agents check` and `et update` registry errors name no fix that fits the repo

- Where: `libs/agent-rules/src/lib/sync.ts:138`; `libs/cli/src/lib/update/registry.ts:206-208`
- Problem: `check` always says "Run \`npx ethlete-agents sync\`", though `packageRunner` is already known (`yarn ethlete-agents sync`; `npx` fails under Yarn PnP). `et update` reports a private-registry auth failure as `https://… answered 401 for @ethlete/core.` with no hint that the token in `.npmrc`/`.yarnrc.yml` is missing or expired.
- Fix: use `config.vars.packageRunner` in the `check` hint. For 401/403, append the config file the token was read from (or "no token found for <registry>"), because `registryAuthorization` already knows which one it was.
- Breaking: no. Decision: no.
- Status: fixed: `check` names `config.vars.packageRunner`; a 401/403 names the `.npmrc` the token came from, or says none was found.
- Review: ok

## TOOL-13 `et release` has no spec for its step order

- Where: `libs/cli/src/lib/release.spec.ts` (4 cases, only `pathsChangedBetween` and `releaseFlags`)
- Problem: the order of version/tag/commit/push (TOOL-01), the abort paths (dirty tree, non-empty answer, no changesets) and the `git add` of only the changed paths are untested. A reorder fix for TOOL-01 would ship without a guard.
- Fix: inject the command runner (or mock `child_process`) and assert the call sequence, including that no tag is created when `git commit` fails.
- Breaking: no. Decision: no.
- Status: fixed: `release.spec.ts` injects the runner and asserts the step order, the no-tag-on-failed-commit path and the abort paths.
- Review: ok
