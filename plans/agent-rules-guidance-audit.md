# Agent-rules guidance audit

Audit date: 2026-08-19. Consumer checked: `fut-frontend` using
`@ethlete/agent-rules@0.1.0-next.11`.

The generated output is mechanically healthy: `yarn ethlete-agents check` passes and all 12
generated `ethlete-*` skills pass the skill-creator structural validator. The problems below
are semantic: conflicting guidance, unnecessary blocking conditions, unsafe cleanup, dangling
cross-references, and examples an agent could copy into broken code.

## Priority 1 — prevent destructive or incorrect actions

### Make SDK local-build cleanup preserve unrelated work

`sdk-local-build` currently recommends `git checkout package.json` and then requires both
`package.json` and `yarn.lock` to be clean. That can erase unrelated edits and treats a dirty
working tree as though every difference belonged to the local SDK experiment.

Change the workflow to:

1. Preflight `package.json` and `yarn.lock` before changing either.
2. If either already differs, stop and ask or record an exact reversible baseline.
3. Restore only the dependency specifier and lockfile delta introduced by the workflow.
4. Verify that the local-build delta is gone, not that both files are globally clean.

Do not recommend whole-file `git checkout`/`git restore` unless the guide has first established
that the files had no pre-existing changes.

### Remove the single-API fallback

`api-source` says that if `apiRepoPaths` has one entry, the agent should use it for every app.
That defeats the app-keyed map and can send an investigation for one frontend to another app's
backend. Require an exact app match. If a shared fallback is useful, give it an explicit
configuration key such as `default` or `*`.

Also make the expected backend branch configurable. “The API's own development branch” is not
discoverable enough to be a blocking condition, and the deployed environment may not track the
remote default branch.

### Do not delete supplied artifacts automatically

`figma-export` tells the agent to delete export files after sign-off, and `handoff` tells it to
delete a completed handoff. Both may be user-supplied or useful records. Only delete files the
agent created and only when the workflow or user explicitly authorizes deletion; otherwise
report that they are no longer needed and let the user decide.

## Priority 2 — resolve contradictory guidance

### Define one color-hardcoding policy

The generated `AGENTS.md` says never to hardcode a color. `theming` permits a static hardcoded
fallback and later tells agents to keep one. Pick one policy and state it identically in both
places. A workable formulation is:

- Never use a hardcoded color as the primary value.
- State explicitly whether a static fallback inside `var(--token, <fallback>)` is required,
  permitted, or forbidden.

The same guide uses `'dark-elevated'` and `'brand'` in an example while `AGENTS.md` says theme
names must never be hardcoded in a type, document, or example. Either replace those with
`<surface-theme-name>` / `<color-theme-name>`, or narrow the rule to hardcoded theme-name
unions and reusable APIs.

### Clarify SDK docs, source, and installed-type precedence

The consumer `AGENTS.md` says to use `ethlete-sdk-source` instead of digging through
`node_modules`. `sdk-docs` and `sdk-source` then say installed `.d.ts` files are the tiebreaker
and that the installed package wins. These statements are reconcilable, but agents have to
infer the distinction.

State the routing directly:

- Start with the SDK skills rather than searching `node_modules` ad hoc.
- Installed `.d.ts` files are authoritative for the public type surface available to the
  consumer.
- Source matching the installed build is authoritative for runtime implementation details.
- A dirty or ahead `next` checkout is not automatically source for the installed package.

The top-level rule can then say that the skill chooses among docs, installed types, and local
source.

### Replace whole-checkout blocking with relevant-path checks

`sdk-source` and `api-source` require the agent to stop and ask whenever the external checkout
is on another branch, behind/ahead, or dirty. In the audited machine, the SDK checkout is on
`next`, its package versions match the consumer exactly, but it is ahead and contains many
unrelated edits. The current rule would block almost every source lookup.

Use a narrower decision tree:

1. Resolve the files relevant to the question.
2. Check whether those files differ in the worktree or relevant commit range.
3. If unrelated paths are dirty, continue without treating them as evidence.
4. If relevant paths are dirty, clearly distinguish worktree behavior from published behavior
   and ask only when that distinction changes the answer.

`git fetch` should be described as worktree-preserving, not “read-only”: it mutates remote refs,
uses the network, and may require approval. Fetch only when freshness is material.

### Make Figma evidence requirements progressive

`figma-export` says not to start without both SVG and CSS, but later allows work to proceed when
the pair cannot be produced. Replace the hard stop with an evidence hierarchy:

- SVG + CSS is the preferred complete input.
- With one missing, inspect existing code and the available artifact, list exactly which facts
  remain unknown, and avoid inventing those measurements.
- Ask before a structural choice or an untraceable numeric value, not before every useful
  read-only step.

The guide also says an SVG provides exact fills and CSS can expose token names, then says none
of the exports tells the colors. Say instead that exports expose rendered color values but do
not determine the authoritative semantic theme token.

## Priority 3 — validate references and examples

### Make exclusion validation reference-aware

The consumer excludes `story-styling` and `verify-in-storybook`, but emitted skills still refer
to them:

- `figma-export` refers to `verify-in-storybook`.
- `theming` refers to `story-styling`.
- `STYLEGUIDE.md` refers to a `changeset` skill that the package does not ship.

`ethlete-agents check` currently passes. Extend validation so every skill/resource reference is
resolved after profile, package requirement, missing-variable, and explicit-exclusion filtering.
For an omitted optional skill, either inline the necessary fallback, conditionally omit the
reference, or fail generation with a precise diagnostic.

Acceptance criteria:

- A generated skill cannot contain a reference to a non-emitted package skill.
- `check` catches dangling references without needing an agent to load the files.
- Plain-text references such as `` `story-styling` `` use a structured template marker so they
  can be validated.

### Test every runnable example

The Angular-pattern example nests a `<button>` inside another `<button>`, and the full
styleguide repeats it. The route example in `STYLEGUIDE.md` is missing commas and is not valid
TypeScript. These examples undermine otherwise strict guidance and are likely to be copied.

Extract fenced examples in package tests where practical:

- Parse TypeScript/JSON/HTML examples.
- Run Prettier as a cheap syntax check.
- Lint examples meant to demonstrate compliant application code.
- Keep intentionally invalid examples isolated to the smallest marked fragment so the complete
  fence remains parseable.

For the Angular example, use two sibling snippets rather than nesting the bad and good buttons.

### Fix or test the query-to-observable example

`query` states that `response()` is retained during re-execution, then shows a search callback
that changes the search signal and immediately returns the shared response observable. On a
second search, the previous response can therefore be the first non-null emission. Existing
subscribers may also observe later searches unless their caller cancels them.

Replace this with the SDK's tested correlation/cancellation pattern, or explicitly filter for
the successful execution matching the requested args. Add a test covering two consecutive
searches where the first response is still present when the second begins.

### Tighten RxJS teardown guidance

“Always unsubscribe,” `takeWhile` as a cleanup mechanism, and “place the limiting operator last”
are too broad:

- Completing finite streams do not need artificial lifecycle teardown.
- `takeWhile` is not destruction cleanup; it can remain subscribed indefinitely when no later
  emission arrives.
- Placement of `take`, `first`, `finalize`, and other limiting/finalization operators changes
  semantics.

Focus the rule on long-lived/manual subscriptions. Prefer `takeUntilDestroyed()` for Angular
lifecycle cleanup and explain its placement relative to higher-order operators. Use `take(1)` or
`first()` only when “one emission” is part of the operation's semantics.

## Priority 4 — reduce context cost and stale duplication

### Split the full styleguide reference

`ethlete-styleguide/STYLEGUIDE.md` is 520 lines, has no table of contents, repeats the focused
Angular/RxJS skills, and contains stale material. It also gives inconsistent Storybook placement
guidance: one section says story files always live in `storybook/`, while a later example places
the `.stories.ts` file at the component root.

Keep `SKILL.md` as the routing entry point and split the reference into focused files such as:

- `lint-rule-lookup.md`
- `file-structure.md`
- `assets.md`
- `storybook-structure.md`
- `changesets.md`

State exactly when each reference should be read. Remove duplicated Angular/RxJS prose so those
rules have one canonical source. If the full reference remains above 100 lines, add a table of
contents.

### Clarify skill provenance in consumer AGENTS.md

The handwritten consumer preamble says skills under `.agents/skills/` are tracked in
`skills-lock.json`, but the generated `ethlete-*` skills are supplied by `ethlete-agents`, and
not every local skill is represented in that lockfile. Document the three categories explicitly:

- package-generated `ethlete-*` skills, updated by `ethlete-agents sync`;
- third-party installed skills tracked by `skills-lock.json`;
- hand-written repository skills.

### Narrow “format every edited file”

“After editing any file, format it” is broader than the command supports and can include binary,
generated, or unsupported files. Say “format every edited Prettier-supported source file,” or
use a command/configuration that safely ignores unknown formats.

## Consumer-only cleanup outside the package

The `fut-frontend` login section says the password is always `TestTest20-` or `ZinneGame`, while
the examples imply an app-specific mapping. Add a Password column to the app table so automation
does not have to try credentials or infer the mapping. This is handwritten consumer guidance,
not an `agent-rules` package change.

## Suggested implementation order

1. Make local-build cleanup non-destructive and remove automatic artifact deletion.
2. Add post-filter skill-reference validation.
3. Resolve color/theme and SDK-source precedence contradictions.
4. Replace whole-checkout dirty-state blocking with relevant-path checks.
5. Repair and automatically validate examples, including the query bridge.
6. Split the styleguide reference and remove duplicated/stale guidance.
7. Apply the smaller provenance and formatting wording fixes.

## Verification

- Generate a consumer fixture with `story-styling` and `verify-in-storybook` excluded; reference
  validation must pass with no dangling names.
- Generate a fixture where a required referenced skill is filtered unexpectedly; `check` must
  fail with the source skill and missing target in the message.
- Run syntax/lint extraction tests over all fenced examples.
- Exercise SDK-source routing with unrelated dirty files, relevant dirty files, an ahead branch,
  and a version mismatch.
- Exercise SDK-local-build cleanup with pre-existing unrelated `package.json` and `yarn.lock`
  changes and prove they are byte-for-byte preserved.
- Sync the updated package into a consumer fixture and run `ethlete-agents check`.
