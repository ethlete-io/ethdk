---
name: git-flow
description: How to name and base a branch in this repo, and what its merge request must target - feature, sub-feature, release, release fix and hotfix. Read BEFORE creating a branch, opening a merge request, or choosing what to branch from (e.g. the user says "start work on FIP-2177" or "open an MR").
kind: skill
scope: both
vars: [gitFlowDevelopmentBranch, gitFlowProductionBranch, gitFlowTypes, gitFlowEnforcement]
---

# Git flow

Work is organised in two levels: a **main feature branch** per Jira Story, into which
**sub-feature branches** (one per Task) are merged after review. The main feature branch is
what gets deployed to a test environment and, once accepted, merged into
`{%gitFlowDevelopmentBranch%}`.

Never guess a branch name - derive it, or let the tooling do it:

```bash
npx ethlete-agents git-flow check                 # is the current branch conforming?
npx ethlete-agents git-flow explain <branch>      # what the parser sees, and what it expects
```

## The five shapes

| Shape                                                        | Issue | Branch from                    | MR targets                                                       |
| ------------------------------------------------------------ | ----- | ------------------------------ | ---------------------------------------------------------------- |
| `feat/FIP-2177-user-management`                              | Story | `{%gitFlowDevelopmentBranch%}` | `{%gitFlowDevelopmentBranch%}`                                   |
| `feat/FIP-2177-user-management/FIP-2178-user-password-reset` | Task  | the main feature branch        | the main feature branch                                          |
| `release/2026.04.28`                                         | -     | `{%gitFlowDevelopmentBranch%}` | `{%gitFlowDevelopmentBranch%}` and `{%gitFlowProductionBranch%}` |
| `release/2026.04.28/FIP-2222-button-not-visible`             | Bug   | the release branch             | the release branch                                               |
| `hotfix/FIP-2799-password-recovery-broken`                   | Bug   | `{%gitFlowProductionBranch%}`  | `{%gitFlowProductionBranch%}`                                    |

- The **type** is one of {%gitFlowTypes%}, and the sub-feature nests under the **full** main
  feature branch name - that path is what makes the parent machine-readable.
- The **key** is the Jira issue, uppercase, immediately after the type. The **subject** is the
  Story's subject meta field in kebab-case, not a paraphrase of the summary.
- A branch with no key still works, but nothing can attribute it to an issue. Add the key.

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
branch unasked.

`dev-*` is the **old spelling of a main feature branch**, not a stray name: sub-features
legitimately target it. Leave a live one alone.

## Commit messages are a separate thing

Commits stay conventional (`feat(platform): Prefer a player's common name`) and carry **no
issue key** - the branch already has it. See {%skill:git-commit%}.
