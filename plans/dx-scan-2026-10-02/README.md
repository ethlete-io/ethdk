# DX scan — 2026-10-02

Scan of the published libs with the focus on developer experience (DX) for a consumer of
`@ethlete/*`. Bugs and missing tests are in scope too. `cdk` (maintenance mode) and
`timetrack` (private, scanned 2026-09-28) are out of scope.

## Phases

1. Scan: one agent per domain writes `<domain>.md` in this folder. Read-only for source.
2. Verify: a second agent re-checks every High and Medium line and marks it `verified` or deletes it.
3. Fix: one agent per slice fixes the verified lines that need no user decision.
4. Decisions: the lines that need a breaking change, a new API or a design choice go to the user.

## What DX means here

Look at the lib through the eyes of an app developer who imports it. Report where that person
loses time:

- **API ergonomics**: inconsistent input/output names across sibling components, a required
  boilerplate that a default could remove, a provider that must be wired by hand, an option that
  only works in combination with another one and does not say so, a signal/observable where the
  other kind is the norm.
- **Types**: weak inference (a generic that collapses to `unknown`/`any`), a public type that is
  not exported, a union that accepts invalid states, overloads that pick the wrong branch.
- **Errors**: a misuse that fails silently, or with a raw `undefined is not a function` instead
  of a dev-mode error with a code; an error message that does not say how to fix it; a missing
  dev-mode warning for a known pitfall (wrong parent, missing provider, invalid input combination).
- **Discoverability**: a public API that has no JSDoc, a JSDoc that is wrong, a docs guide in
  `apps/docs` that disagrees with the code, a feature with no story, an export that is missing from
  the entry point, an `@internal`/`subtle` member that leaks as normal API.
- **Testing DX**: a component without a test harness/fake in its `testing` folder where siblings
  have one; a harness that cannot reach a common state.
- **Tooling DX** (cli, eslint-plugin, agent-rules): unclear CLI output, a rule message that does not
  say how to fix, a missing auto-fixer that is mechanical, a false positive.
- **Bugs**: real defects you can show from the code (with the exact input that triggers them).
- **Test gaps**: public behavior with no spec, scenario or e2e coverage, where a regression is
  likely.

## Rules for scan agents

- Do not edit any file outside your own `plans/dx-scan-2026-10-02/<domain>.md`. Do not commit.
- Read the code. Every finding cites `path:line` and is checked against the code, not guessed.
- Do not report a finding that a recent commit already fixed (`git log --oneline -60 -- <path>`).
- Known decisions — do not report against them:
  - Components are signal-forms native (`FormValueControl`, `[formField]`); no `ControlValueAccessor`.
  - No `<dialog>` / Popover top-layer APIs.
  - `subtle` namespace members are intentionally not normal public API.
  - Breaking changes are acceptable (one consumer); mark them `breaking`, do not avoid them.
  - Component CSS is plain CSS in `@layer components`; no Tailwind in component source.
- Quality over count. 10 sharp findings beat 40 vague ones. No style nits that lint already covers.
- Time box: about 60 minutes / 80 tool calls. At the box, write what you have and stop.

## Output format (`<domain>.md`)

```markdown
# <domain> — DX scan 2026-10-02

Scope: <paths>

| ID   | Sev  | Kind | Decision | Title |
| ---- | ---- | ---- | -------- | ----- |
| X-01 | High | dx   | no       | ...   |

## X-01 <title>

- Where: `path:line`
- Problem: what the consumer hits, with a concrete snippet or input.
- Fix: the proposed change, concrete enough to hand to an agent.
- Breaking: yes/no. Decision: yes if it needs a product/API choice from the user.
```

Kind is one of `dx`, `bug`, `test-gap`. Sev: High = a consumer is likely to hit it and loses real
time or ships a defect; Medium = real but narrower; Low = polish.

## Domains

| File                 | Scope                                                                                                          |
| -------------------- | -------------------------------------------------------------------------------------------------------------- |
| `core.md`            | `libs/core`                                                                                                    |
| `query-a.md`         | `libs/query`: client, query creators, http, gql, cache, devtools hooks                                         |
| `query-b.md`         | `libs/query`: auth, ws, query-form, testing utilities                                                          |
| `tooling.md`         | `libs/cli`, `libs/eslint-plugin`, `libs/agent-rules`                                                           |
| `misc-libs.md`       | `libs/contentful`, `libs/types`, `libs/query-devtools`                                                         |
| `rte.md`             | `components/forms/rich-text-editor`, `multi-language-rich-text-editor`                                         |
| `date-time.md`       | `components/forms/date-time`, `time-picker`, `calendar`                                                        |
| `select.md`          | `components/forms/select`, `cascader`, `selection-list`, `tag-input`, `choice-field`                           |
| `form-inputs.md`     | the rest of `components/forms` (form-field, inputs, dropzone, form, forms/testing, …)                          |
| `overlay.md`         | `components` overlay, menu, tooltip, toggletip, filter-overlay, command-palette, notification, floating-action |
| `table-grid.md`      | `components` table, grid, chart                                                                                |
| `bracket.md`         | `libs/bracket`, `components` bracket, match, standings                                                         |
| `sched-stream.md`    | `components` scheduler, stream                                                                                 |
| `components-rest.md` | every other `components` domain, `components/testing`, `internals`, the entry-point exports                    |

## Rules for fix agents

A fix agent gets one domain file and a list of IDs. It verifies and fixes in one pass.

1. For each ID, check the claim against the code. A `bug` or `test-gap` line gets a spec (or
   scenario/e2e test, see the testing skills) that fails before the fix. If the claim is wrong,
   mark the line `rejected: <reason>` in the domain file and move on.
2. Fix it. Follow the `styleguide`, `component-architecture` and `theming` skills where they apply.
3. Update the matching `apps/docs` guide for every public API or behavior change (`docs` skill).
4. Write one changeset per lib in `.changeset/` (`changeset` skill). Do not run `npx changeset`.
5. Run lint with `--fix`, Prettier on the edited files, and only the specs of your own paths, in the
   foreground. Do not run the whole components test project; the coordinator runs it once.
6. Mark each line in the domain file `fixed` (or `rejected`). Do not commit. Do not touch files
   outside your scope; other agents work in parallel in the same tree.
7. Time box: about 60 minutes / 100 tool calls. At the box, leave the tree compiling and report
   what is left. Final reply: brief, one line per ID, plus the list of files you changed.

## User decisions (2026-10-02)

- OV-01: add `closeOnNavigation` to overlays, default `true`, opt-out per overlay.
- CR-02: add the public entry point `@ethlete/components/testing`: the jsdom shims (ResizeObserver,
  IntersectionObserver, matchMedia, `Element.animate`) and the existing drivers, modelled on
  `@ethlete/query/testing`.
- DT-01/DT-04: split the date token into Date, DateTime and Time tokens; date-only controls get a
  date-only wire format by default. Breaking.
- FI-06: add `provideFormFieldDefaults()` for `appearance`, `labelMode`, `size`, `fill`; inputs win.

## Wave 2 queue (start after the domain's wave-1 agent is committed)

- CR-02 `@ethlete/components/testing` (after overlay + components-rest).
- OV-01 `closeOnNavigation` (after overlay).
- DT-01/DT-04 date token split (after date-time).
- FI-06 `provideFormFieldDefaults()` (after form-inputs).
- CR-12 the `error-codes.md` gaps (after all components agents).
- consumer-fifagg.md: FG-01 peer ranges, FG-02..FG-04, FG-06..FG-11 (after tooling).
- consumer-ea.md (when its scan lands).

## Rules for review agents

A review agent gets one finished fix slice (a domain file and its list of changed files).

1. Read the full diff of those files (`git diff -- <files>`, plus the new untracked files). Check each
   change against its finding: correct, minimal, no regression, specs that prove it, docs and changeset
   present, the AGENTS.md comment allowlist followed (delete comments that do not qualify).
2. Fix small defects yourself. Report anything larger instead of fixing it.
3. Run lint and the specs for the slice's projects/paths in the foreground. For a failure that looks
   unrelated, check it on a clean baseline in a throwaway worktree
   (`git worktree add /tmp/base-<slice> HEAD`, remove it after). Never use `git stash`, `git checkout --`
   or `git reset`: other agents have uncommitted work in the same tree.
4. If the verdict is ready, commit exactly the slice files (`git add <files>`, never `-A`; message per the `git-commit` skill; the pre-push hook is not involved). Final reply, max 5 lines: verdict (ready / not ready), the defects you fixed, the open problems,
   and the exact file list to commit for this slice.

## Coordinator checkpoint (2026-10-02 evening)

- Wave 1 fix agents (one per domain file, all resumed after the 20:30 limit reset): core, query-b,
  tooling (done, in review), misc-libs, rte, date-time, select, form-inputs, overlay, table-grid,
  bracket, sched-stream, components-rest. query-a is done (not yet reviewed; review together with query-b).
- Flow per slice: fix agent done → review agent (rules above) reviews and COMMITS its slice → next.
- Nothing from this round is committed yet. Uncommitted changes of all slices share the tree.
- Then the wave 2 queue above, then the consumer-ea.md / consumer-fifagg.md lines.
- Side task: Slack release message (highlights + thread/changelog link) in `tools/changesets-action`.
- 2026-10-02 late: auto mode blocked the tooling review agent's edits ("Modify Shared Resources");
  waiting for the user (A: allow subagent edits/commits, B: coordinator commits). Tooling slice: ready
  except the `release()` breaking note in the cli changeset, 3 eslint-plugin changeset lines, two
  internal JSDoc descriptions, `detectCommandVars` once in `init()`. no-cdk-import failures are
  cwd-only (pre-existing); query-skill-coverage fails on the query slice's new public export
  `queryCreatedOutsideInjectionContext` (query slice must fix).
- date-time fix done (DT-02,03,07..13); rerun `date-time-query-form-binding.spec.ts` on a quiet machine;
  `forms.md` has one shared `timeZone` row.
- select fix done (all but SEL-04/06); new codes ET5200-5202 — check for clashes with other slices;
  it wrapped the bare radio/checkbox in `forms/selection-card.spec.ts`; `error-codes.md` reflowed.
- Still running at handoff: core, query-b, misc-libs, rte, form-inputs, overlay, table-grid, bracket,
  sched-stream, components-rest fix agents; the Slack agent. Their state lives in the tree and in the
  `Status:` lines of each domain file. A fresh coordinator: for each domain file whose IDs all carry a
  status, run a review agent (rules above), then commit the slice. Review query-a + query-b together.
- Open user decisions: every line still marked `Decision: yes` and without a status, plus SEL-04/06,
  QA-03/06/13, TG-01/03/04/07, SS-02/03/05, BR-08, RTE-05/06/07, MISC-07/13, CR-05/06/09, QB-02/12,
  DT-05/06, the EA/FG decision lines.
