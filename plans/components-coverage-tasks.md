# Components consumer coverage (S8b) - task list

Branch: next. Other sessions share the checkout and may have uncommitted files. Do not touch or commit them.

## Goal

Consumer coverage (`plans/query-consumer-coverage.md`, step S8b): scenario tests for what apps use of
`@ethlete/components`, guarded by `tools/export-coverage` (`node tools/export-coverage/check.mjs`). Each bug a
scenario finds gets a fix, a changeset, and a test that fails without the fix. This file is a task list for one
agent that works alone, batch by batch.

## State

- Done: button, overlay, stream, table, icon, forms/date-time, forms/rich-text-editor, scheduler, grid,
  forms/form-field, bracket, tabs, forms/select, notification, menu, match. Components: 933 of 1381 covered
  (before the cascader batch). Per-domain notes are under "S8b progress" in the plan.
- In progress on 2026-09-26: forms/cascader + forms/dropzone + forms/color-input (64), run by a subagent. If
  `check.mjs components` still reports those as "allowlisted but covered", do task 0 first.
- Removed on 2026-09-26 by user decision: `GridItemRef` and `configComponent` (e519882bc). Added:
  `FormFieldDirective.controlSuffixTemplate` (e38133536).

## Rules for every batch

- Before a batch: add or update the line `In progress <date>: <domains>` at the end of the S8b notes in the plan,
  and commit it alone. A usage limit then loses nothing.
- Name files `libs/components/src/scenarios/<domain>*.scenario.spec.ts` (forms: `forms-<control>*`). Pattern files:
  `forms-select.scenario.spec.ts`, `bracket.scenario.spec.ts`, `menu.scenario.spec.ts`, `grid.scenario.spec.ts`.
- An export counts as covered when the scenario imports it from `../index` and uses it as an app would. Test real
  behavior (DOM, keyboard, aria, emitted values), not existence.
- Get a batch's exports: `node tools/export-coverage/check.mjs components --list | grep -E "S8b (a|b|c)$"`.
- After the scenarios are committed: remove only the entries that `check.mjs components` reports as
  "allowlisted but covered" AND whose reason is `S8b <domain>` of this batch. Never `check.mjs --update`. Commit the
  allowlist and a plan note (done count, commit shas, bugs, friction, E2E gaps) together. Stale entries fail
  `.husky/pre-push` for every session, so commit the removal at once.
- Checks per batch: `npx vitest run --config libs/components/vite.config.mts <files>`;
  `npx tsc --noEmit -p libs/components/tsconfig.spec.json` (vitest does not type-check); `npx eslint <changed files>`
  with zero new warnings; `npx prettier --write <changed files>`.
- Git: NEVER `git stash`, `git add -A`, `--amend` or worktrees. `git add -- <new>` then
  `git commit -m "type(scope): Subject" -- <paths>`. No Co-Authored-By trailer. Generic fixtures (team-a), no client
  names. `export TMPDIR=/home/tom/.cache/tmp-s8b NX_NO_CLOUD=true`.
- Comments: almost none (AGENTS.md allowlist).
- If you delegate a batch, use `model: "opus"`, a fresh subagent per batch, and pass these rules verbatim. The
  subagent must not edit the allowlist or the plan.

## Task list

0. Finish the cascader batch if it is still open: remove its covered entries (`S8b forms/(cascader|dropzone|color-input)`),
   plan note, one commit.
1. breadcrumb 23, command-palette 20, carousel 19 (62).
2. scrollable 18, forms/selection-list 16, query-error 15, filter-overlay 15 (64).
3. chart 17, calendar 15, standings 14, forms/slider 14 (60). Before chart: run `ListAgents` and tell any session
   that works in chart stories.
4. forms/phone-input 14, forms/input 13, accordion 13, picture 11, pagination 11 (62).
5. tree 10, time-picker 10, chip 10, kbd 9, floating-action 9, forms/masked-input 8, loader 7 (63).
6. forms/multi-language-rich-text-editor 7, banner 7, toggletip 6, overlay 6, stream 5, scrollbar 5,
   progress-steps 5, masonry 5, badge 5, avatar 5, tooltip 4, toolbar 4, skeleton 4, forms/tag-input 4,
   forms/rating 4 (76).
7. timeline, forms/textarea, forms/form, forms/choice-field, description-list, card (3 each), forms/switch,
   forms/otp-input, forms/description, forms/checkbox, empty-state, divider, copy-button (2 each), version,
   forms/selection-card, focus-ring (1 each) (35). Then `check.mjs components --list | grep -c S8b` must be 0.
   Mark S8b done in `plans/query-consumer-coverage.md`, and delete this file.
8. E2E: turn the "E2E gaps" of each S8b note into `apps/storybook-e2e` suites. Read the
   `component-behavior-tests` skill first. One commit per domain, biggest user impact first (select, menu,
   date-time, overlay, tabs).
9. Before any push: ask the user, then run the `ci-check` skill.

## Open items that need the user (do not decide alone)

- `it.fails` in `table-features-rows.scenario.spec.ts`: a numeric `rowKey` turns into a string, so a
  `new Set([3])` selection matches nothing.
- Headless tab bar: after `.focus()` on a trigger, the arrow keys move from the selected tab. Find out whether
  this is a bug before you fix it.
- `BracketMatchComponent` in `@ethlete/bracket` lacks `bracketRoundSwissGroup`, which `et-bracket` always binds
  (NG0303 for a custom card typed by it). Widening the type is likely right; it is outside S8b.
- The docs recommend `<a et-match-card></a>`, but `@angular-eslint/template/elements-content` rejects it.

## Gotchas

- /tmp is a tmpfs with few inodes. The classifier blocks `rm -rf` in /tmp; ask the user to run it.
- Harness: no per-test providers; `s.flush()` never settles while a timer or query client lives (use
  `s.tick(); s.flush()`); a dev `RuntimeError` element log lands in `s.errors` only after `s.tick(1)`; jsdom lacks
  `ResizeObserver`, `matchMedia`, `Element.animate` (polyfills in `libs/components/src/scenarios/test-helpers`)
  and component CSS (inject `display:block` against "display of 'inline'" errors); menus and overlays throw
  without an `error`-typed colour theme.
- `check.mjs` scans the working tree, so an untracked scenario of a running agent makes entries look covered.
  Remove only entries whose scenario is committed.

## Verify

- `node tools/export-coverage/check.mjs`
- `npx vitest run --config libs/components/vite.config.mts libs/components/src/scenarios`
- `npx tsc --noEmit -p libs/components/tsconfig.spec.json`
