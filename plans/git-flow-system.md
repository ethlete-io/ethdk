# Git flow as one system: grammar, skill, lint, CLI

Scope worked out with Tom on 2026-08-11, alongside `plans/timetrack.md`. `git-flow-draft.md`
describes a branch convention in prose. This plan turns it into **one machine-readable
grammar with many consumers** - a skill so agents follow it, a check command, a local hook, a
CI job, and `@ethlete/timetrack`'s correlation parser - so the convention is never transcribed
five times and never drifts between the doc and the validator.

The loop closes: the grammar defines branch names → timetrack reads branch names to attribute
time → timetrack's create flow writes branch names through the same grammar → the hook and CI
enforce them → the skill teaches agents to produce them. Each surface makes the others more
accurate, which is the actual argument for building it as a system rather than as four
loosely related conveniences.

## Decisions locked

| Question    | Decision                                                                                     |
| ----------- | -------------------------------------------------------------------------------------------- |
| Home        | `@ethlete/agent-rules` - see the constraint below                                            |
| Enforcement | Local git hook + CI job on MRs + CLI check command                                           |
| Strictness  | Ships **advisory**: the whole naming zoo is accepted and nothing blocks; gate per repo later |
| Scope       | Product repos only; `ethlete-sdk` itself stays exempt (direct commits to `next`, no gate)    |

## Why `@ethlete/agent-rules` is the right home

It is already the distribution channel, and that settles it. Verified in
`/home/tom/dev/fut-frontend`: `@ethlete/agent-rules@0.1.0-next.5` is a dependency, there is an
`ethlete-agents.config.json` with a `vars` block, `.agents/` and `.claude/` are generated, and
`AGENTS.md` carries the marker block. Every product repo that needs branch validation has
already installed the package that would provide it, and already has the config file the
grammar belongs in. A new `@ethlete/git-flow` lib would need a second install, a second
release cadence and a second config file to say the same things.

The decisive argument is drift: the package's renderer interpolates `vars` into skill and rule
bodies (`{% token %}` in `libs/agent-rules/src/lib/render.ts`, supporting strings and
backtick-joined arrays, plus `{% skill:name %}` / `{% resource:file %}` links). So the skill can
be generated **from the same config the validator reads**. The documented grammar and the
enforced grammar become the same data, which is precisely the failure mode a hand-written
skill would reintroduce.

**One hard constraint.** `@ethlete/timetrack`'s core is framework-agnostic, browser-safe and
bundled into a Tauri webview. It cannot import a Node CLI. So the grammar module must be pure:
no `fs`, no `path`, no `process`, zero dependencies, and reachable on its own.

Today `libs/agent-rules/package.json` is `"type": "commonjs"` with `"main": "./src/index.js"`,
a `bin`, and no `exports` map. The plan therefore adds one:

```jsonc
{
  "exports": {
    ".": { "types": "./src/index.d.ts", "default": "./src/index.js" },
    "./git-flow": { "types": "./src/lib/git-flow/index.d.ts", "default": "./src/lib/git-flow/index.js" },
  },
}
```

`libs/agent-rules/src/lib/git-flow/` holds the config schema, the parser and the validators and
imports nothing. The CLI, the skill generator and timetrack all consume that one module.
`@nx/dependency-checks` will want the peer/dependency lists to match what each side actually
imports - expect a lint pass on both libs after wiring it (per `AGENTS.md`, a mismatch is an
error, not a warning), and a `yarn install` if any `package.json` changes.

Escape hatch, worth writing down: because the module is isolated and dependency-free from day
one, extracting it into a standalone `@ethlete/git-flow` later is mechanical - a move plus a
re-export. Do that only if the naming genuinely starts to mislead or the webview bundle picks
up something it shouldn't.

## The grammar as data

From `git-flow-draft.md`, the five shapes - plus the one legacy spelling that means the same
thing as the first:

```
feat/FIP-2177-user-management                                 main feature   → Story, base next
feat/FIP-2177-user-management/FIP-2178-user-password-reset    sub-feature    → Task, base parent
release/2026.04.28                                            release        → base next
release/2026.04.28/FIP-2222-button-not-visible                release fix    → Bug, base release
hotfix/FIP-2799-password-recovery-broken                      hotfix         → Bug, base main

dev-game-codes                                                main feature, deprecated spelling
```

Each shape declares three things the tooling needs: which Jira issue it corresponds to, what it
must be branched **from**, and what an MR from it must **target**. The MR target is the more
valuable of the two enforcement points - a wrong branch name is cosmetic, a sub-feature merged
straight into `next` bypasses the whole feature-branch test cycle.

### Two of the five shapes cannot exist, and the fix is one prefix

Found while implementing `start`, verified with git 2.55 both locally and against a bare remote:
**git refuses a ref that is both a branch and a directory of branches.** So
`feat/FIP-2177-user-management/FIP-2178-user-password-reset` cannot exist while
`feat/FIP-2177-user-management` does - which is exactly the branch the draft says it is split
from and merged back into. `git branch` fails with `cannot lock ref … 'refs/heads/feat/FIP-2177-user-management' exists`
and a push is rejected with `refname conflict`. The same applies to
`release/2026.04.28/FIP-2222-button-not-visible` against `release/2026.04.28`.

The evidence that this was never noticed: of 124 branches in `fut-frontend`, **zero** have three
segments and **zero** are a nested pair. The sub-feature shape has never been used, because it
never could be. What the team does instead - flat branches merged into a `dev-*` integration
branch - is the same two-level process without the encoding, exactly as the tolerance section
below describes.

**Decision: nested branches carry a `sub/` prefix** (`subPrefix` in the config).

```
feat/FIP-2177-user-management                                       unchanged
sub/feat/FIP-2177-user-management/FIP-2178-user-password-reset      the Task
release/2026.04.28                                                  unchanged
sub/release/2026.04.28/FIP-2222-button-not-visible                  the release fix
```

Chosen over the alternatives because it is the only one that fixes both broken shapes with one
rule while keeping the parent's **full path inside the child's name** - so `expectedMrTargets`
stays derivable from the name alone, with no key → branch lookup and no impurity in the parser.
It also renames nothing that exists today: the main feature and release branches keep the names
the draft gives them. Suffixing the parent instead (`feat/…/main` + `feat/…/FIP-2178-…`) would
group children next to their parent in GitLab's branch list, but every integration and release
branch would have to be renamed to accept a child.

The unprefixed spelling still parses - as `sub-feature`/`release-fix`, `deprecated: true`, with a
finding that says why it cannot exist and what to rename it to - so `explain` and `repair` give a
useful answer instead of "unrecognised".

Config sketch, living under a `gitFlow` key in `ethlete-agents.config.json`:

```jsonc
{
  "gitFlow": {
    "enforcement": "advisory",
    "keyPattern": "[A-Z]{2,10}-\\d+",
    "baseBranches": { "development": "next", "production": "main" },
    "types": ["feat", "fix", "refactor", "chore", "docs", "perf", "test", "style", "build", "ci"],
    "typeAliases": { "feature": "feat", "bugfix": "fix" },
    "releasePattern": "release/\\d{4}\\.\\d{2}\\.\\d{2}",
    "hotfixPrefix": "hotfix",
    "subjectCase": "kebab",
    "deprecatedShapes": [
      { "match": "^dev-(?<subject>.+)$", "kind": "main-feature", "renameTo": "feat/<KEY>-<subject>" },
    ],
    "severity": {
      "unknown-type": "warn",
      "missing-key": "warn",
      "key-case": "warn",
      "missing-subject": "warn",
      "type-alias": "warn",
      "deprecated-prefix": "warn",
      "wrong-mr-target": "warn",
      "protected-push": "error",
    },
  },
}
```

What shipped differs from the sketch in four small ways: `releasePrefix` was split out of
`releasePattern` so the prefix is available when _building_ a name; a `release-date` rule was
added because a malformed date is a real violation that no other rule described honestly;
`keyPrefixes` was added for the reason in the tolerance section below; and `subPrefix` was added
for the reason above.

Two notes for implementation. The renderer's `vars` values are strings or string arrays, so a
nested `gitFlow` object will not interpolate into skill bodies as-is - either flatten the tokens
the skill needs (`gitFlowBaseBranch`, `gitFlowTypes`, `gitFlowKeyPattern`) or teach the renderer
to read a dotted path. And per-rule `severity` is what makes strictness configurable, but it is
not the knob anyone should have to reach for first - see the grace period below.

### The grace period comes first, and it is one knob

The naming zoo is allowed on purpose at the start. Everyone gets time to adapt to a convention
that has, so far, been a prose document nobody's tooling mentioned; a gate that lands the same
week the rule becomes discoverable would just teach people to pass `--no-verify`.

So `enforcement` is a single top-level mode, not seven severities to talk somebody through:

- **`advisory`** (the shipping default) - every rule still runs and still reports, `explain`
  still tells the truth, `check --all` still produces the adoption report, and **nothing ever
  exits non-zero**. Every naming shape in the zoo is accepted: no key, `feature/` instead of
  `feat/`, lowercase keys, no subject, `dev-*`, unknown types. The output is a suggestion plus
  the `repair` command that would fix it, and the developer decides.
- **`gated`** - per-rule `severity` takes effect and `error` rules fail the hook and the CI job.

Two rules sit outside the mode, because they are not about naming and were never part of the
zoo. `protected-push` (a direct push to `main` or `next`) stays `error` in both modes, and it is
really the server-side protection's job anyway - the local check is just a faster error message.
And `wrong-mr-target` is the rule worth promoting first when the grace period ends, since a
sub-feature merged straight into `next` skips the feature-branch test cycle the whole flow exists
to provide - a misnamed branch costs nobody anything by comparison.

Phasing out later is then a one-line config change per repo, made when that repo's own
`check --all` report says it is ready, rather than a coordinated flag day across every product
repo at once.

### The parser has to be tolerant, and here is exactly how tolerant

`git-flow-draft.md` dates the convention to 29.5.26. Branches created in `fut-frontend` since
then, from `git for-each-ref --sort=-committerdate`:

| Branch                                        | Created    | Verdict                           |
| --------------------------------------------- | ---------- | --------------------------------- |
| `feat/FIP-2869-internal-asset-upload`         | 2026-08-06 | conforms                          |
| `feat/FIP-2902-hub-game-codes-list-view`      | 2026-07-09 | conforms                          |
| `feature/FIP-2904-game-codes-detail-view`     | 2026-08-10 | `feature/` alias                  |
| `feature/FIP-2926`                            | 2026-07-27 | alias, and no subject             |
| `feat/fip-2762-managers-and-contacts-widget`  | 2026-07-17 | lowercase key                     |
| `feat/collection-item-rejection-tooltip`      | 2026-08-10 | no key                            |
| `feat/logout-confirmation`                    | 2026-08-06 | no key                            |
| `feat/system-stats-and-season-scoped-leagues` | 2026-08-07 | no key                            |
| `refactor/hub-cdk-to-components`              | 2026-08-06 | no key                            |
| `fix/ratings-reveal-secondary-page-27`        | 2026-08-04 | no key; `-27` is FC 27, not an id |
| `dev-game-codes`, `dev-list-view-next`, …     | 2026-06/07 | the old name for a feature branch |

Three of about sixteen fully conform by name. But naming conformance badly understates process
conformance, because of what `dev-*` actually is: **an integration branch that reviewed
sub-branches land in, which then merges into `next`, and `next` into `main`.** That is the
draft's Haupt-Feature-Branch, under its old name. The two-level integration process the grammar
describes is therefore already how the team works - what is missing is the encoding (the key,
and the path nesting that makes the parent machine-readable), not the workflow. That is a much
cheaper gap to close than a behavioural change, and it means the migration is mostly renames.

So:

- Aliases (`feature/` → `feat/`) and lowercase keys parse successfully, uppercase the key, and
  report a low-severity finding. They are typos, not different intents.
- A key with no subject parses; the subject is optional in the result type.
- A trailing bare number is **not** a key. Only `keyPattern` matches count, so
  `ratings-reveal-secondary-page-27` yields no key rather than a wrong one. A confidently wrong
  attribution is worse in timetrack than none.
- **`dev-*` parses as a deprecated spelling of `main-feature`, not as an unknown shape.** This is
  the one classification that has to be right, and it is not about tidiness. If the parser treated
  `dev-game-codes` as unrecognised, then `wrong-mr-target` - the first rule slated for promotion -
  would fire on **every** legitimate sub-branch MR into an integration branch, which is to say on
  the team's entire actual workflow. So the shape is declared, it yields
  `kind: 'main-feature'` with no key, and it is a **valid MR target** for a sub-feature. The only
  finding it carries is a rename suggestion.
  Beyond that it behaves like any deprecated shape: no finding on a branch that already exists,
  excluded from the `check --all` adoption report so it does not permanently skew the numbers, and
  mentioned but never blocked while `enforcement` is `advisory`. Under `gated` the asymmetry is
  new-versus-existing - an existing `dev-*` branch still reports nothing, a newly created one is
  the only thing worth failing on. Distinguishing the two needs the branch's age, which git can
  supply (the first commit unique to the branch, or the merge-base date against `next`).
  `post-checkout` gets that for free because it knows the ref was just created; an MR pipeline has
  to compute it, so keep `deprecated-prefix` a warning there rather than paying for a date lookup
  to block something already in flight. `start` never emits one either way, because it builds
  names from the grammar.
- **A word followed by a number is not a key either, and anchoring alone does not catch it.**
  Found by running the parser over all 123 branches in fut-frontend: `chore/angular-22`,
  `chore/tailwind-4` and `feature/top-105-list` all match `[A-Z]{2,10}-\d+` case-insensitively at
  the start of the segment, and were attributed to issues `ANGULAR-22`, `TAILWIND-4` and `TOP-105`.
  Nothing structural separates them from `fip-2762`; only knowing the project's prefixes does.
  Hence `keyPrefixes` in the config - empty accepts anything the pattern matches, `["FIP"]` takes
  all three false positives to zero. Every product repo should set it.
- **A keyless sub-branch can still be attributed through its parent.** Since reviewed branches
  land in an integration branch, a flat name like `feat/collection-item-rejection-tooltip` has a
  parent that may well carry a key - reachable from the MR target, or locally from the merge-base
  against the candidate integration branches. So the parser exposes a `resolveThroughBase` step:
  given a keyless branch and its base, inherit the base's `storyKey` as the Story and leave the
  Task unknown. Deterministic, no model involved, and it is the rule that makes the current zoo
  tractable rather than opaque.
- Every parse returns `{ ok, kind, storyKey, taskKey, subject, expectedBase, expectedMrTarget, findings[] }`
  - never a throw. Both the validator and timetrack's correlation engine read the same result;
    the validator reports `findings`, timetrack reads the keys and penalises confidence when
    `findings` is non-empty.

## Consumers

### 1. The skill

New portable content at `libs/agent-rules/content/skills/git-flow/SKILL.md`, `kind: skill`,
`scope: both`, with the grammar interpolated from config. It teaches an agent: how to name a
branch for a Story vs a Task, what to branch from, what an MR must target, that shared feature
branches are **merged** with `next` and never rebased (rebase only on local unpublished
branches), that sub-feature branches are deleted on merge, and that hotfixes go off `main` and
merge back into both. All of that is in the draft as prose and none of it is currently
discoverable by an agent.

It is added to `"exclude"` in this repo's own `ethlete-agents.config.json`, exactly as
`git-commit` and `handoff` already are - the SDK does not follow the flow. It ships to
fut-frontend and every other product repo via `ethlete-agents sync`.

Deliberately out of the skill: commit message rules. Commits stay conventional with no ticket
key (`feat(platform): Prefer a player's common name over their last name`), commitlint already
enforces that, and the `git-commit` skill already documents it. Do not add keys to commit
subjects - it would duplicate the branch's information at the point where it is least useful.

### 2. `ethlete-agents git-flow …`

The single implementation the hook and CI both call, so there is exactly one place where a
verdict is computed:

- `check [ref]` - validate a branch name; `--target <branch>` additionally validates the MR
  target. Exits non-zero only on findings whose configured severity is `error`.
- `check --all` - sweep every local and remote branch, for a one-time adoption report.
- `start <KEY>` - the prospective flow: read the issue from Jira, compute the branch name from
  the grammar, branch from the correct base. This is the same operation as timetrack's
  ticket → branch flow, and it must be the same code, not a parallel implementation.
- `repair <ref>` - propose the conforming name for a non-conforming branch and, on confirm,
  rename it locally and on the remote and retitle the MR. Given the table above, this is the
  command that actually moves the repo toward the convention; the check command only complains.
  For a `dev-*` branch the target is well defined - `dev-game-codes` → `feat/<KEY>-game-codes`,
  needing only the Story key - so this is a rename with a lookup, not a redesign. Renaming an
  integration branch that has open MRs pointed at it must retarget those MRs, or it breaks
  everyone's in-flight work; if that cannot be done reliably through the GitLab API, `repair`
  should refuse and say so rather than half-finish.
- `explain <ref>` - print what the parser saw. The debugging affordance that stops "why is my
  branch flagged" turning into a guessing game.

### 3. Local git hook

A `pre-push` check on the branch name, plus a `post-checkout` notice when a newly created branch
does not conform (that is the moment a rename is free).

Important detail found in fut-frontend: `.husky/pre-push` and `.husky/post-checkout` **already
exist and are git-lfs hooks**. The check must be appended to them, never overwrite them - and
`.husky/pre-commit` already runs `nx affected:lint` plus `git-format-staged`, so the git-flow
check does not belong there.

**Answered: `sync` writes them, opt-in** via a `gitHooks` array, as an
`# ethlete:git-flow:start`/`end` block appended to `.husky/<name>` - the same marker-block
contract as `AGENTS.md`, and removing the name takes the block back out again. Three constraints
the implementation turned up, none of them obvious:

- **Only `.husky/`, never `.git/hooks/`.** The generated files are committed and CI's `check`
  diffs them; a hook outside the working tree could never be in sync. Without a `.husky/`
  directory, `sync` warns and writes nothing rather than writing somewhere CI cannot see.
- **The block must not read stdin.** It is appended _after_ the git-lfs hook, and a `pre-push`
  hook's ref list on stdin can only be consumed once - lfs has already taken it. So the check
  runs against the current branch instead of the pushed refs, which is also why `--target` has no
  place in a hook: the pushed ref is the same branch, not a merge request target.
- **Never `npx`.** `npx --no-install` still reaches the registry when the package is absent, and
  that network error would reject the push. The block calls `node_modules/.bin/ethlete-agents`
  directly, so a repo without the package gets silence. `ETHLETE_GIT_FLOW_SKIP=1` opts out per
  machine.

### 4. CI job on MRs

fut-frontend's `.gitlab-ci.yml` has a `Checks` stage already holding `Lint` and `Format`; a
`Git Flow` job goes beside them. GitLab exposes exactly what the rule needs as predefined
variables: `CI_MERGE_REQUEST_SOURCE_BRANCH_NAME`, `CI_MERGE_REQUEST_TARGET_BRANCH_NAME` and
`CI_COMMIT_REF_NAME`. The job runs only on merge-request pipelines, calls
`ethlete-agents git-flow check "$CI_MERGE_REQUEST_SOURCE_BRANCH_NAME" --target "$CI_MERGE_REQUEST_TARGET_BRANCH_NAME"`,
and carries `allow_failure: true` on top of `advisory` mode - belt and braces, so the job exists
and reports for a whole grace period before it can ever be the reason an MR is red.

### 5. Server-side rules (documented, not automated)

The half no client-side check can enforce, and already a TODO assigned to Tom in the draft:
protect `main` and `next` so direct pushes are limited to named exceptions; a push rule with the
branch-name regex derived from the same grammar; required approvals matching "reviewed by
another developer"; delete-source-branch and squash defaults per branch type. The plan writes the
exact settings down; applying them stays a human action in the GitLab UI.

### 6. `@ethlete/timetrack`

Imports `@ethlete/agent-rules/git-flow` and deletes its own `grammar/` folder from
`plans/timetrack.md`'s proposed layout. Its correlation engine reads `storyKey`/`taskKey` from
the parse result and downgrades confidence when `findings` is non-empty - which is the same
tolerance data the validator surfaces as warnings, used for a different purpose. Its
ticket → branch → draft MR flow calls the CLI's `start` implementation.

## Rollout

The first four steps all happen in `advisory` mode. Nothing anyone does to a branch name can
fail a hook or a pipeline until step 6, and that is deliberate.

1. ~~**Land the grammar, parser and `check`/`explain`** in `advisory`.~~ **Done** -
   `libs/agent-rules/src/lib/git-flow/` plus `ethlete-agents git-flow check|explain`.
2. ~~**Ship the skill.**~~ **Done** - `libs/agent-rules/content/skills/git-flow/SKILL.md`,
   `scope: both`, excluded in this repo. It is the step that actually changes behaviour, and it
   was worth doing before any gate exists: people and agents start producing conforming names
   because the convention is finally discoverable at the moment a branch gets created, not
   because something rejected them afterwards.
3. ~~**Make `start` the easy path.**~~ **Done** - `git-flow start <KEY>` reads the issue from Jira,
   derives the kind from the issue's own parent field (not from an assumed hierarchy), plans the
   name through the shared `planStart`, and creates the branch off the right base after showing the
   plan. `git-flow repair` renames a branch and retargets the merge requests aimed at it. The
   `gitHooks` opt-in emits the `pre-push` and `post-checkout` blocks. A command that names the
   branch correctly, from the right base, in one step beats any amount of enforcement: adoption is
   a tooling problem before it is a discipline problem.
4. **Run `check --all` per repo** and watch the ratio move. `dev-*` drops out as deprecated, so
   the numbers describe only branches anyone intends to keep creating. Use `repair` on what is
   worth repairing - particularly any still-open feature branch a sub-feature should nest under,
   since nested branches cannot exist until their parents conform.
5. **Promote `wrong-mr-target` first**, once the open MRs conform. It is the only rule where being
   wrong has a real consequence, and it is not a naming rule, so it can go early without ending
   the naming grace period.
6. **Flip `enforcement` to `gated`, per repo, when that repo's report says it is ready.** Not a
   flag day - fut-frontend can gate months before another repo does, and each flip is one line.

## Open questions

1. ~~**Should `ethlete-agents sync` write git hooks**, given they can block a push?~~
   **Answered: yes, opt-in** - see consumer 3 above for the contract and the three constraints.
2. ~~**Does the renderer need dotted-path or object `vars`?**~~ **Answered: neither.** `loadConfig`
   derives `gitFlowDevelopmentBranch`, `gitFlowProductionBranch`, `gitFlowTypes` and
   `gitFlowEnforcement` from the resolved `gitFlow` block and merges them into `vars` ahead of the
   repo's own, so the skill interpolates from the same data the validator reads and a repo can
   still override a token. The renderer was not touched.
3. **Release-fix branches nested under `release/<date>`** share their shape with sub-features but
   base on the release branch. Confirm a fix branch's MR targets the release branch only, and
   that the merge back into `next` and `main` is a separate, non-flagged operation.
4. **How the story-subject meta field relates to the branch subject** - the draft says the Jira
   Story carries the subject as a meta field, which means `start` can read it rather than derive
   it from the summary. Same unknown field as in `plans/timetrack.md`. `start` reads it from
   `jira.subjectField` when configured and otherwise slugifies the summary, saying which it used -
   so this is now a one-line config change, not a blocker. The field id is still unknown.
5. ~~**`git-flow-draft.md` needs updating with the `sub/` prefix**~~ **Done for the repo copy** -
   sections 2 and 3 now name `sub/feat/…` and `sub/release/…`, with the git constraint spelled out
   once under section 2. The repo copy is a transcription, so the canonical doc still has to be
   corrected and **the team still has to be told** - the tooling and the convention's source of
   truth disagree on two of five shapes until that happens.
6. **Should `start` also open the draft merge request?** `plans/timetrack.md` puts the branch →
   draft MR step in its own flow, and `repair` already carries a GitLab client that `start` could
   reuse. Deliberately left out for now: `start` writes to git only, which keeps the blast radius
   of a wrong plan local.
7. **Do the live `dev-*` integration branches get renamed or left to finish?** `dev-gamecodes`
   moved on 2026-08-11, so at least one is active. Renaming it retargets its open MRs; letting it
   run out means the first `feat/<KEY>-…` integration branches appear alongside it. Leaving it
   alone is probably right, but it is a decision, not an oversight.
8. **Does anything but a main feature branch use the `dev-` prefix?** The mapping to
   `kind: 'main-feature'` assumes not. `dev-temp-hub-staging` reads more like an environment
   branch than a feature, and if shapes like that exist they need their own classification rather
   than being mislabelled as integration branches.
