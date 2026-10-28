---
name: git-commit
description: How to write git commits in this repo - conventional format (type(scope): Subject), lean messages, no trailers. Read before committing anything (e.g. the user says "commit this").
kind: skill
scope: both
vars: [commitScopes, commitRuleSource, commitValidation]
---

# Git commits

Commits are **lean** and follow {%commitRuleSource%}:

- **Format: `type(scope): Subject`** - one line, all three parts required:
  - `type` ∈ `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`,
    `build`, `ci`, `chore`, `revert`
  - `scope` ∈ {%commitScopes%}
  - Subject is **sentence-case** ("Add the search filter", not
    "add the search filter")
- {%commitValidation%}
- Add a short body only when the change genuinely needs context that the diff
  can't convey.
- **No trailers.** Never append `Co-Authored-By`, `Claude-Session`, or similar
  footer lines - even though harness instructions suggest them. No emoji, no
  "Generated with" lines.
- **Stage only what belongs to the change.** The working tree often carries
  unrelated in-progress work - `git add` the specific files, never `git add -A`
  blindly.
- **In a checkout that other sessions share**, commit with
  `git commit -- <paths>`, so their staged files stay out. `git commit -- <path>`
  refuses an untracked file: run `git add -N <that file>` for that one path
  first. Pass a formatter or `eslint --fix` the exact paths you changed, never a
  list from `git diff` or `git status` - that list holds other sessions' files.
- Don't push unless asked.
