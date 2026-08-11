---
name: git-flow
description: How to name and base a branch in this repo, and what its merge request must target - feature, sub-feature, release, release fix and hotfix. Read BEFORE creating a branch, opening a merge request, or choosing what to branch from (e.g. the user says "start work on FIP-2177" or "open an MR").
kind: skill
scope: both
vars: [gitFlowDevelopmentBranch, gitFlowProductionBranch, gitFlowTypes, gitFlowEnforcement, gitFlowSubPrefix]
---

# Git flow

Work is organised in two levels: a **main feature branch** per Jira Story, into which
**sub-feature branches** (one per Task) are merged after review. The main feature branch is
what gets deployed to a test environment and, once accepted, merged into
`{%gitFlowDevelopmentBranch%}`.

**Never name a branch by hand - `start` does it from the grammar:**

```bash
npx ethlete-agents git-flow start FIP-2178        # reads the issue, names it, branches off the right base
npx ethlete-agents git-flow check                 # is the current branch conforming?
npx ethlete-agents git-flow explain <branch>      # what the parser sees, and what it expects
npx ethlete-agents git-flow repair <branch>       # rename a non-conforming one, retarget its MRs
```

`start` prints its plan (branch, base, MR target) and asks before writing anything; add
`--dry-run` to see the plan alone. It refuses on a dirty working tree, and a Task nests under
its parent Story's branch, so that branch has to exist first.

## The five shapes

| Shape                                                                             | Issue | Branch from                    | MR targets                                                       |
| --------------------------------------------------------------------------------- | ----- | ------------------------------ | ---------------------------------------------------------------- |
| `feat/FIP-2177-user-management`                                                   | Story | `{%gitFlowDevelopmentBranch%}` | `{%gitFlowDevelopmentBranch%}`                                   |
| `{%gitFlowSubPrefix%}/feat/FIP-2177-user-management/FIP-2178-user-password-reset` | Task  | the main feature branch        | the main feature branch                                          |
| `release/2026.04.28`                                                              | -     | `{%gitFlowDevelopmentBranch%}` | `{%gitFlowDevelopmentBranch%}` and `{%gitFlowProductionBranch%}` |
| `{%gitFlowSubPrefix%}/release/2026.04.28/FIP-2222-button-not-visible`             | Bug   | the release branch             | the release branch                                               |
| `hotfix/FIP-2799-password-recovery-broken`                                        | Bug   | `{%gitFlowProductionBranch%}`  | `{%gitFlowProductionBranch%}`                                    |

- The **type** is one of {%gitFlowTypes%}, and a nested branch carries its parent's **full**
  name - that path is what makes the parent machine-readable.
- The **key** is the Jira issue, uppercase, immediately after the type. The **subject** is the
  Story's subject meta field in kebab-case, not a paraphrase of the summary.
- A branch with no key still works, but nothing can attribute it to an issue. Add the key.

### Why a nested branch starts with `{%gitFlowSubPrefix%}/`

Git refuses a ref that is both a branch and a directory of branches. So
`feat/FIP-2177-user-management/FIP-2178-user-password-reset` **cannot exist** while
`feat/FIP-2177-user-management` does - git rejects it locally and the push comes back as
`refname conflict`. The prefix moves the nested tree out of the way and keeps the parent's
full path inside the child's name, so the MR target is still readable off the name.

Do not "fix" a name by dropping the prefix; the branch it produces cannot be created.

## Rules that are not about naming

- **Never rebase a shared branch.** A main feature branch is published and other people's
  sub-features are based on it - bring it up to date by **merging**
  `{%gitFlowDevelopmentBranch%}` into it. Rebase only a local branch you have not pushed.
- **A sub-feature merges into its parent, never straight into
  `{%gitFlowDevelopmentBranch%}`** - that is the whole point of the two levels, since the
  parent is what gets tested as a unit.
- **Delete the source branch on merge** (the checkbox in the merge request) for sub-features,
  release fixes and merged main features.
- **A hotfix branches off `{%gitFlowProductionBranch%}`** and, after rollout, that branch is
  merged back into `{%gitFlowDevelopmentBranch%}` so the two do not drift.
- **Never push directly to `{%gitFlowDevelopmentBranch%}` or
  `{%gitFlowProductionBranch%}`.** Open a merge request; it needs another developer's review.

## Enforcement is `{%gitFlowEnforcement%}`

In `advisory` mode every rule reports and nothing blocks - the older naming shapes (`feature/`
instead of `feat/`, a lowercase key, no key at all, a `dev-*` integration branch) are accepted
on purpose while the team adapts. Report the suggestion, do not "fix" someone's existing
branch unasked - `repair` is how a rename happens, and only when asked for.

`dev-*` is the **old spelling of a main feature branch**, not a stray name: sub-features
legitimately target it. Leave a live one alone.

## Commit messages are a separate thing

Commits stay conventional (`feat(platform): Prefer a player's common name`) and carry **no
issue key** - the branch already has it. See {%skill:git-commit%}.
